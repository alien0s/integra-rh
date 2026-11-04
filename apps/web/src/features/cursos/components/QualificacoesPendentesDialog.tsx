import { useCallback, useEffect, useState } from 'react'
import { BookOpen, ClipboardList, GraduationCap, Languages, Loader2, type LucideIcon } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { formatarTituloFormacao, NIVEL_CEFR_LABEL } from '@/lib/cursos'
import { DetalheQualificacaoConteudo } from './DetalheQualificacaoConteudo'
import { cursosService } from '../services'
import type {
  CursoQualificacaoModeracao,
  FormacaoAcademicaModeracao,
  IdiomaModeracao,
  TabelaQualificacao,
} from '../types'

const TIPO_CURSO_LABEL: Record<CursoQualificacaoModeracao['tipo'], string> = {
  CERTIFICACAO: 'Certificação',
  CURSO: 'Curso',
  WORKSHOP: 'Workshop',
}

/** Um item da fila, já normalizado pras 3 origens (formação/curso/idioma). */
interface ItemFila {
  chave: string
  referenciaTabela: TabelaQualificacao
  referenciaId: string
  funcionarioNome: string
  fotoUrl: string
  iniciais: string
  createdAt: string
  icone: LucideIcon
  tituloTipo: string
  resumo: string
}

function chaveDe(referenciaTabela: TabelaQualificacao, referenciaId: string): string {
  return `${referenciaTabela}:${referenciaId}`
}

function paraItens(dados: {
  formacoes: FormacaoAcademicaModeracao[]
  cursos: CursoQualificacaoModeracao[]
  idiomas: IdiomaModeracao[]
}): ItemFila[] {
  const itens: ItemFila[] = [
    ...dados.formacoes.map((f) => ({
      chave: chaveDe('qualificacoes_academicas', f.id),
      referenciaTabela: 'qualificacoes_academicas' as const,
      referenciaId: f.id,
      funcionarioNome: f.funcionarioNome,
      fotoUrl: f.fotoUrl,
      iniciais: f.iniciais,
      createdAt: f.createdAt,
      icone: GraduationCap,
      tituloTipo: 'Formação acadêmica',
      resumo: formatarTituloFormacao(f.nivel, f.curso),
    })),
    ...dados.cursos.map((c) => ({
      chave: chaveDe('qualificacoes_cursos', c.id),
      referenciaTabela: 'qualificacoes_cursos' as const,
      referenciaId: c.id,
      funcionarioNome: c.funcionarioNome,
      fotoUrl: c.fotoUrl,
      iniciais: c.iniciais,
      createdAt: c.createdAt,
      icone: BookOpen,
      tituloTipo: TIPO_CURSO_LABEL[c.tipo],
      resumo: c.nome,
    })),
    ...dados.idiomas.map((i) => ({
      chave: chaveDe('qualificacoes_idiomas', i.id),
      referenciaTabela: 'qualificacoes_idiomas' as const,
      referenciaId: i.id,
      funcionarioNome: i.funcionarioNome,
      fotoUrl: i.fotoUrl,
      iniciais: i.iniciais,
      createdAt: i.createdAt,
      icone: Languages,
      tituloTipo: 'Idioma',
      resumo: `${i.idioma} — ${NIVEL_CEFR_LABEL[i.nivelCefr]}`,
    })),
  ]
  return itens.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

async function aprovarItem(item: ItemFila): Promise<void> {
  if (item.referenciaTabela === 'qualificacoes_academicas') {
    await cursosService.aprovarFormacao(item.referenciaId)
  } else if (item.referenciaTabela === 'qualificacoes_cursos') {
    await cursosService.aprovarCurso(item.referenciaId)
  } else {
    await cursosService.aprovarIdioma(item.referenciaId)
  }
}

async function recusarItem(item: ItemFila, motivo: string): Promise<void> {
  if (item.referenciaTabela === 'qualificacoes_academicas') {
    await cursosService.recusarFormacao(item.referenciaId, motivo)
  } else if (item.referenciaTabela === 'qualificacoes_cursos') {
    await cursosService.recusarCurso(item.referenciaId, motivo)
  } else {
    await cursosService.recusarIdioma(item.referenciaId, motivo)
  }
}

/** "15/10/2026" a partir de um ISO com hora. */
function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}

/**
 * Fila de moderação (RH/DP/Admin): tudo que está PENDENTE agora — formação,
 * curso/workshop/certificação e idioma juntos, ordenados do mais antigo pro
 * mais novo. Complementa a notificação avulsa (que alguém pode perder/
 * dispensar sem decidir): aqui dá pra ver e tratar tudo de uma vez, inclusive
 * em lote (marcar vários com o checkbox e aprovar/recusar todos juntos).
 *
 * Marcar o checkbox NÃO abre o detalhe — clicar no resto da linha troca o
 * conteúdo do MESMO dialog pro detalhe (`DetalheQualificacaoConteudo`, o
 * mesmo usado pelo `DetalheQualificacaoDialog` avulso das notificações),
 * com um botão "Voltar" pra retornar à lista, em vez de abrir um segundo
 * dialog por cima. A recusa em lote usa UM motivo só, aplicado a todos os
 * selecionados (confirmado no texto do AlertDialog) — evitar pedir uma
 * justificativa por item deixaria a ação em massa inviável na prática.
 */
export function QualificacoesPendentesDialog() {
  const [aberto, setAberto] = useState(false)
  const [itens, setItens] = useState<ItemFila[]>([])
  const [itemAberto, setItemAberto] = useState<ItemFila | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [carregando, setCarregando] = useState(true)
  const [processando, setProcessando] = useState(false)
  const [motivoRecusaLote, setMotivoRecusaLote] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const novos = paraItens(await cursosService.getPendentes())
      setItens(novos)
      // Mantém marcado só quem ainda está na lista (um item decidido por
      // fora, ex. pelo DetalheQualificacaoDialog avulso, some sozinho).
      const chavesValidas = new Set(novos.map((item) => item.chave))
      setSelecionados((atual) => new Set([...atual].filter((chave) => chavesValidas.has(chave))))
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao buscar a fila de moderação.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (aberto) carregar()
  }, [aberto, carregar])

  function handleAbertoChange(novo: boolean) {
    setAberto(novo)
    // Fechou o dialog inteiro (não só voltou da tela de detalhe) — some com
    // o detalhe também, senão reabrir mostraria o detalhe de novo em vez da
    // lista.
    if (!novo) setItemAberto(null)
  }

  /** Fecha o detalhe e volta pra lista — `decidiu` recarrega (algo mudou no servidor). */
  function handleFecharDetalhe(decidiu: boolean) {
    setItemAberto(null)
    if (decidiu) carregar()
  }

  function alternarSelecao(chave: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(chave)) novo.delete(chave)
      else novo.add(chave)
      return novo
    })
  }

  function alternarSelecionarTodos() {
    setSelecionados((atual) =>
      atual.size === itens.length ? new Set() : new Set(itens.map((item) => item.chave)),
    )
  }

  /** Roda `acao` em todos os selecionados; falhas individuais não travam o resto. */
  async function processarLote(
    acao: (item: ItemFila) => Promise<void>,
    rotulo: { sucesso: string; falha: string },
  ) {
    const alvos = itens.filter((item) => selecionados.has(item.chave))
    if (alvos.length === 0) return
    setProcessando(true)
    try {
      const resultados = await Promise.allSettled(alvos.map(acao))
      const falhas = resultados.filter((r) => r.status === 'rejected').length
      const sucessos = alvos.length - falhas
      if (sucessos > 0) {
        toast({
          title: `${sucessos} ${rotulo.sucesso}${sucessos > 1 ? 's' : ''}`,
          duration: 3000,
        })
      }
      if (falhas > 0) {
        toast({
          title: `${falhas} ${rotulo.falha}${falhas > 1 ? 's' : ''}`,
          description: 'Tente novamente pros itens que falharam.',
          variant: 'destructive',
        })
      }
      setSelecionados(new Set())
      await carregar()
    } finally {
      setProcessando(false)
    }
  }

  async function handleAprovarLote() {
    await processarLote(aprovarItem, { sucesso: 'item aprovado', falha: 'falhou ao aprovar' })
  }

  async function handleRecusarLote() {
    const motivo = motivoRecusaLote.trim()
    if (motivo.length === 0) return
    await processarLote((item) => recusarItem(item, motivo), {
      sucesso: 'item recusado',
      falha: 'falhou ao recusar',
    })
    setMotivoRecusaLote('')
  }

  const qtdSelecionados = selecionados.size
  const todosSelecionados = itens.length > 0 && qtdSelecionados === itens.length

  return (
    <Dialog open={aberto} onOpenChange={handleAbertoChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ClipboardList className="mr-2 h-4 w-4" />
          Pendentes
          {itens.length > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5">
              {itens.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        {itemAberto ? (
          <DetalheQualificacaoConteudo
            referenciaTabela={itemAberto.referenciaTabela}
            referenciaId={itemAberto.referenciaId}
            nomeFuncionario={itemAberto.funcionarioNome}
            onVoltar={() => setItemAberto(null)}
            onFechar={handleFecharDetalhe}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Cursos e formação — pendentes</DialogTitle>
              <DialogDescription>
                Tudo que está aguardando aprovação agora, do mais antigo pro mais novo. Marque
                vários pra aprovar ou recusar de uma vez.
              </DialogDescription>
            </DialogHeader>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            {!carregando && itens.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={todosSelecionados}
                  onCheckedChange={alternarSelecionarTodos}
                  disabled={processando}
                />
                Selecionar todos
              </label>
            )}

            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
              {carregando ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : itens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nada pendente no momento.</p>
              ) : (
                itens.map((item) => {
                  const Icone = item.icone
                  return (
                    <div
                      key={item.chave}
                      className="flex items-center gap-3 rounded-lg border p-3 has-[button:hover]:bg-muted/50"
                    >
                      <Checkbox
                        checked={selecionados.has(item.chave)}
                        onCheckedChange={() => alternarSelecao(item.chave)}
                        disabled={processando}
                      />
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        onClick={() => setItemAberto(item)}
                      >
                        <Avatar className="h-9 w-9 rounded-lg">
                          <AvatarImage
                            src={item.fotoUrl}
                            alt={item.funcionarioNome}
                            className="rounded-lg"
                          />
                          <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                            {item.iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid min-w-0 flex-1 gap-0.5">
                          <span className="truncate text-sm font-medium leading-none">
                            {item.funcionarioNome}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {item.tituloTipo} · {item.resumo}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Icone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatarData(item.createdAt)}
                          </span>
                        </div>
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {itens.length > 0 && (
              <DialogFooter className="gap-2 sm:gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1"
                      disabled={qtdSelecionados === 0 || processando}
                    >
                      Recusar {qtdSelecionados > 0 ? `(${qtdSelecionados})` : ''}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar recusa em lote</AlertDialogTitle>
                      <AlertDialogDescription>
                        Justifique a recusa — o mesmo motivo vale pros {qtdSelecionados} item(ns)
                        selecionado(s) e notifica cada funcionário.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                      value={motivoRecusaLote}
                      onChange={(e) => setMotivoRecusaLote(e.target.value)}
                      placeholder="Motivo da recusa…"
                      className="min-h-24"
                    />
                    <AlertDialogFooter className="flex-row justify-end gap-2 space-x-0">
                      <AlertDialogCancel className="flex-1" onClick={() => setMotivoRecusaLote('')}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={motivoRecusaLote.trim().length === 0 || processando}
                        className="flex-1 bg-red-600 text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                        onClick={handleRecusarLote}
                      >
                        Recusar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  className="flex-1 bg-green-600 text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-500"
                  disabled={qtdSelecionados === 0 || processando}
                  onClick={handleAprovarLote}
                >
                  {processando ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Aprovar ${qtdSelecionados > 0 ? `(${qtdSelecionados})` : ''}`
                  )}
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
