import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Eye, GraduationCap, Languages, Loader2, type LucideIcon } from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/cn'
import { NIVEL_CEFR_LABEL, NIVEL_FORMACAO_LABEL } from '@/lib/cursos'
import { abrirArquivo } from '@/features/visualizador-arquivo'
import { cursosService } from '../services'
import type {
  CursoQualificacao,
  FormacaoAcademica,
  Idioma,
  StatusQualificacao,
  TabelaQualificacao,
} from '../types'

type Registro = FormacaoAcademica | CursoQualificacao | Idioma

const ICONE_POR_TABELA: Record<TabelaQualificacao, LucideIcon> = {
  qualificacoes_academicas: GraduationCap,
  qualificacoes_cursos: BookOpen,
  qualificacoes_idiomas: Languages,
}

const TITULO_POR_TABELA: Record<TabelaQualificacao, string> = {
  qualificacoes_academicas: 'Formação acadêmica',
  qualificacoes_cursos: 'Curso, workshop ou certificação',
  qualificacoes_idiomas: 'Idioma',
}

const TIPO_CURSO_LABEL: Record<CursoQualificacao['tipo'], string> = {
  CERTIFICACAO: 'Certificação',
  CURSO: 'Curso',
  WORKSHOP: 'Workshop',
}

const SITUACAO_FORMACAO_LABEL: Record<FormacaoAcademica['situacao'], string> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  TRANCADO: 'Trancado',
}

const STATUS_LABEL: Record<StatusQualificacao, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
}

const STATUS_BADGE_CLASS: Record<StatusQualificacao, string> = {
  PENDENTE:
    'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  APROVADO:
    'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  RECUSADO: 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400',
}

function ehFormacao(tabela: TabelaQualificacao, registro: Registro): registro is FormacaoAcademica {
  return tabela === 'qualificacoes_academicas'
}

function ehCurso(tabela: TabelaQualificacao, registro: Registro): registro is CursoQualificacao {
  return tabela === 'qualificacoes_cursos'
}

function ehIdioma(tabela: TabelaQualificacao, registro: Registro): registro is Idioma {
  return tabela === 'qualificacoes_idiomas'
}

function formatarPeriodo(anoInicio: number, anoFim: number | null) {
  return `${anoInicio} - ${anoFim ?? 'Presente'}`
}

/** Uma linha "rótulo em cima, valor embaixo" — mesmo padrão visual dos modais de cadastro. */
function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

export interface DetalheQualificacaoConteudoProps {
  referenciaTabela: TabelaQualificacao
  referenciaId: string
  nomeFuncionario: string | null
  /** Chamado ao fechar — `decidiu=true` só quando aprovou/recusou com sucesso. */
  onFechar: (decidiu: boolean) => void
  /**
   * Quando informado, troca o espaço do ícone por uma seta "Voltar" — usado
   * quando este conteúdo está embutido em outro dialog (ex.:
   * QualificacoesPendentesDialog), pra voltar pra lista sem fechar o dialog
   * inteiro. Sem isso (uso avulso, ver DetalheQualificacaoDialog), some.
   */
  onVoltar?: () => void
}

/**
 * Conteúdo (sem `<Dialog>`/`<DialogContent>` em volta) de detalhe de uma
 * qualificação (formação acadêmica, curso/workshop/certificação ou idioma)
 * — mesmas informações dos modais de cadastro (NewGraduacaoModal/
 * NewCursoModal/NewIdiomaModal), só que em modo leitura; enquanto o registro
 * estiver PENDENTE, ganha os botões Aprovar/Recusar.
 *
 * Extraído pra ser reaproveitado em dois lugares: `DetalheQualificacaoDialog`
 * (dialog avulso, aberto ao clicar numa notificação — ver store global
 * `lib/detalheQualificacaoStore.ts`) e `QualificacoesPendentesDialog`
 * (embutido no MESMO dialog da fila de moderação, trocando o conteúdo em
 * vez de abrir um segundo dialog por cima).
 */
export function DetalheQualificacaoConteudo({
  referenciaTabela,
  referenciaId,
  nomeFuncionario,
  onFechar,
  onVoltar,
}: DetalheQualificacaoConteudoProps) {
  const [registro, setRegistro] = useState<Registro | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [decidindo, setDecidindo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [abrindoAnexo, setAbrindoAnexo] = useState(false)

  useEffect(() => {
    let ativo = true
    setCarregando(true)
    setErro(null)
    setRegistro(null)

    const busca =
      referenciaTabela === 'qualificacoes_academicas'
        ? cursosService.getFormacao(referenciaId)
        : referenciaTabela === 'qualificacoes_cursos'
          ? cursosService.getCurso(referenciaId)
          : cursosService.getIdioma(referenciaId)

    busca
      .then((dado) => {
        if (ativo) setRegistro(dado)
      })
      .catch((e) => {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o registro.')
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })

    return () => {
      ativo = false
    }
  }, [referenciaTabela, referenciaId])

  async function handleVerAnexo(titulo: string) {
    setAbrindoAnexo(true)
    try {
      const blob =
        referenciaTabela === 'qualificacoes_academicas'
          ? await cursosService.baixarAnexoFormacao(referenciaId)
          : await cursosService.baixarCertificadoCurso(referenciaId)
      abrirArquivo({ blob, titulo })
    } finally {
      setAbrindoAnexo(false)
    }
  }

  async function handleAprovar() {
    setDecidindo(true)
    try {
      if (referenciaTabela === 'qualificacoes_academicas') {
        await cursosService.aprovarFormacao(referenciaId)
      } else if (referenciaTabela === 'qualificacoes_cursos') {
        await cursosService.aprovarCurso(referenciaId)
      } else {
        await cursosService.aprovarIdioma(referenciaId)
      }
      toast({ title: 'Aprovado', duration: 3000 })
      onFechar(true)
    } catch (e) {
      toast({
        title: 'Não foi possível aprovar',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDecidindo(false)
    }
  }

  async function handleRecusar() {
    if (motivo.trim().length === 0) return
    setDecidindo(true)
    try {
      if (referenciaTabela === 'qualificacoes_academicas') {
        await cursosService.recusarFormacao(referenciaId, motivo.trim())
      } else if (referenciaTabela === 'qualificacoes_cursos') {
        await cursosService.recusarCurso(referenciaId, motivo.trim())
      } else {
        await cursosService.recusarIdioma(referenciaId, motivo.trim())
      }
      toast({ title: 'Recusado', duration: 3000 })
      onFechar(true)
    } catch (e) {
      toast({
        title: 'Não foi possível recusar',
        description: e instanceof Error ? e.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setDecidindo(false)
    }
  }

  const Icone = ICONE_POR_TABELA[referenciaTabela]
  const titulo = TITULO_POR_TABELA[referenciaTabela]
  const status = registro?.status
  const pendente = status === 'PENDENTE'

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          {onVoltar ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-2 h-8 w-8 shrink-0"
              onClick={onVoltar}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Icone className="h-5 w-5" />
            </div>
          )}
          <div className="space-y-1">
            <DialogTitle>{titulo}</DialogTitle>
            {nomeFuncionario ? (
              <DialogDescription>Cadastrado por {nomeFuncionario}</DialogDescription>
            ) : null}
          </div>
        </div>
      </DialogHeader>

      {carregando ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : erro ? (
        <p className="py-6 text-center text-sm text-destructive">{erro}</p>
      ) : registro ? (
        <div className="grid gap-4">
          {status ? (
            <Badge variant="secondary" className={cn('w-fit', STATUS_BADGE_CLASS[status])}>
              {STATUS_LABEL[status]}
            </Badge>
          ) : null}

          {ehFormacao(referenciaTabela, registro) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Nível" value={NIVEL_FORMACAO_LABEL[registro.nivel]} />
              <Campo label="Situação" value={SITUACAO_FORMACAO_LABEL[registro.situacao]} />
              <Campo label="Curso" value={registro.curso} />
              <Campo label="Instituição" value={registro.instituicao} />
              <Campo label="Período" value={formatarPeriodo(registro.anoInicio, registro.anoFim)} />
              {registro.anexoUrl ? (
                <div className="col-span-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={abrindoAnexo}
                    onClick={() => handleVerAnexo(registro.curso)}
                  >
                    {abrindoAnexo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Ver diploma
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {ehCurso(referenciaTabela, registro) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Tipo" value={TIPO_CURSO_LABEL[registro.tipo]} />
              <Campo label="Nome" value={registro.nome} />
              <Campo label="Instituição" value={registro.instituicao} />
              <Campo
                label="Carga horária"
                value={registro.cargaHoraria ? `${registro.cargaHoraria}h` : 'Não informada'}
              />
              <Campo label="Emissão" value={registro.dataEmissao ?? 'Não informada'} />
              <Campo label="Validade" value={registro.dataValidade ?? 'Sem validade'} />
              {registro.certificadoUrl ? (
                <div className="col-span-full">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={abrindoAnexo}
                    onClick={() => handleVerAnexo(registro.nome)}
                  >
                    {abrindoAnexo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    Ver certificado
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {ehIdioma(referenciaTabela, registro) && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Idioma" value={registro.idioma} />
              <Campo label="Nível (CEFR)" value={NIVEL_CEFR_LABEL[registro.nivelCefr]} />
              <Campo
                label="Origem"
                value={registro.origemAvaliacao === 'AUTODECLARADO' ? 'Autodeclarado' : 'Teste interno'}
              />
            </div>
          )}

          {status === 'RECUSADO' && registro.motivoRecusa ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              <span className="font-medium">Motivo da recusa: </span>
              {registro.motivoRecusa}
            </div>
          ) : null}
        </div>
      ) : null}

      {pendente ? (
        <DialogFooter className="gap-2 sm:gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex-1" disabled={decidindo}>
                Recusar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar recusa</AlertDialogTitle>
                <AlertDialogDescription>
                  Justifique a recusa. A justificativa notifica {nomeFuncionario ?? 'o funcionário'}{' '}
                  e fica registrada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo da recusa…"
                className="min-h-24"
              />
              <AlertDialogFooter className="flex-row justify-end gap-2 space-x-0">
                <AlertDialogCancel className="flex-1" onClick={() => setMotivo('')}>
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={motivo.trim().length === 0 || decidindo}
                  className="flex-1 bg-red-600 text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                  onClick={handleRecusar}
                >
                  Recusar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            className="flex-1 bg-green-600 text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-500"
            disabled={decidindo}
            onClick={handleAprovar}
          >
            Aprovar
          </Button>
        </DialogFooter>
      ) : registro ? (
        <DialogFooter>
          <Button variant="outline" onClick={() => onFechar(false)}>
            Fechar
          </Button>
        </DialogFooter>
      ) : null}
    </>
  )
}
