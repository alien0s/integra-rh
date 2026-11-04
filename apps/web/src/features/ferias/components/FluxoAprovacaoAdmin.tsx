import { Fragment, useEffect, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronsUpDown,
  Info,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Users,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

import { useUsuarioLogado } from '@/features/auth/hooks'
import { GRUPOS_ENTIDADE } from '@/features/tabelas/types'
import type { Setor } from '@/features/tabelas/types'
import { usePapeis, useSetores } from '@/features/tabelas/hooks'
import { useFluxoAprovadores } from '../hooks'
import type { FluxoAprovador, FluxoAprovadorInput } from '../types'

/**
 * Etapas do fluxo de férias — espelham PAPEL_POR_ETAPA (feriasFluxo.ts) e os
 * rótulos já usados nas abas de FeriasOverview.tsx. Fixas por enquanto (só
 * existem essas 3 etapas de decisão hoje).
 */
const ETAPAS = [
  {
    codigo: 'PENDENTE',
    numero: 1,
    titulo: 'Aprovação gestor',
    padrao: 'Gestor do setor do colaborador',
  },
  {
    codigo: 'APROVADO_GESTOR',
    numero: 2,
    titulo: 'Aprovação RH',
    padrao: 'Recursos Humanos',
  },
  {
    codigo: 'APROVADO_RH',
    numero: 3,
    titulo: 'Tesoureiro Assistente',
    padrao: 'Tesoureiro Assistente',
  },
] as const

/** Sentinela do filtro de entidade — "sem filtro", mostra exceções de todos os grupos. */
const TODAS_ENTIDADES = 'TODAS'

/**
 * Etapa exibida no stepper — as 3 fixas (ETAPAS) mais eventuais etapas novas
 * criadas só visualmente (`extra: true`, sem `padrao` porque não existem no
 * fluxo real `feriasFluxo.ts`).
 */
interface EtapaView {
  codigo: string
  titulo: string
  padrao: string | null
  extra: boolean
}

interface FormState {
  setorIds: string[]
}

/** Combobox de múltipla seleção (checkbox) sobre a lista de setores. */
function SetoresMultiSelect({
  setores,
  selecionados,
  onChange,
}: {
  setores: Setor[]
  selecionados: string[]
  onChange: (ids: string[]) => void
}) {
  const [aberto, setAberto] = useState(false)
  const nomes = setores.filter((s) => selecionados.includes(s.id)).map((s) => s.nome)

  function alternar(id: string) {
    onChange(
      selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id],
    )
  }

  return (
    <Popover open={aberto} onOpenChange={setAberto}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={aberto}
          className="w-full justify-between font-normal"
        >
          <span className="truncate text-sm">
            {nomes.length > 0 ? nomes.join(', ') : 'Selecione os setores'}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput placeholder="Buscar setor…" />
          <CommandList
            onWheel={(event) => {
              event.currentTarget.scrollTop += event.deltaY
              event.stopPropagation()
            }}
          >
            <CommandEmpty>Nenhum setor encontrado.</CommandEmpty>
            <CommandGroup>
              {setores.map((setor) => {
                const selecionado = selecionados.includes(setor.id)
                return (
                  <CommandItem
                    key={setor.id}
                    value={setor.nome}
                    onSelect={() => alternar(setor.id)}
                    className={cn(
                      selecionado &&
                        'bg-blue-600 text-white data-[selected=true]:bg-blue-600 data-[selected=true]:text-white',
                    )}
                  >
                    <span className="flex-1 truncate text-sm">{setor.nome}</span>
                    <Check
                      className={cn('h-4 w-4', selecionado ? 'opacity-100 !text-white' : 'opacity-0')}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Card de exceção já cadastrada — resolução (papel/setores). O grupo não é
 * repetido aqui (já aparece no filtro "Entidade" do topo da tela); exceções
 * por usuário seguem mostrando o nome, já que esse dado não aparece em
 * nenhum outro lugar da tela.
 */
function ExcecaoCard({ excecao, onExcluir }: { excecao: FluxoAprovador; onExcluir: () => void }) {
  const setorNomes = excecao.setorNomes ?? []
  const conjunta = !excecao.papelId && setorNomes.length > 1
  const resolucaoLinha = excecao.papelId
    ? `Papel: ${excecao.papelNome}`
    : !conjunta
      ? `Setor: ${setorNomes[0] ?? '—'}`
      : null

  // Título principal: nome da pessoa (escopo por usuário) ou, na falta dele
  // (escopo por grupo — já identificado no filtro "Entidade" do topo), a
  // própria resolução; exceto quando é aprovação conjunta, que ganha seu
  // próprio cabeçalho mais abaixo.
  const titulo = excecao.userNome ?? (conjunta ? null : resolucaoLinha)
  const detalhe = excecao.userNome ? resolucaoLinha : null

  return (
    <div className="flex flex-col gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs dark:border-blue-900 dark:bg-blue-950/40">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1 truncate font-medium">{titulo}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={onExcluir}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>

      {detalhe && <span className="truncate text-[11px] text-muted-foreground">{detalhe}</span>}

      {conjunta && (
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
            <Users className="h-3 w-3" />
            Aprovação conjunta ({setorNomes.length} setores)
          </span>
          <div className="flex flex-wrap gap-1">
            {setorNomes.map((nome) => (
              <span
                key={nome}
                className="rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[11px] dark:border-blue-800 dark:bg-blue-950"
              >
                {nome}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Formulário inline (sem modal aninhado) pra criar uma múltipla aprovação
 * numa etapa: escolhe os setores cujos responsáveis decidem essa etapa em
 * conjunto. O grupo de entidade não é escolhido aqui — vem do filtro
 * "Entidade" no topo da tela (`grupoAtivo`); sem uma entidade selecionada
 * não dá pra salvar.
 */
function FormNovaExcecao({
  setores,
  grupoAtivo,
  onSalvar,
  onCancelar,
}: {
  setores: Setor[]
  grupoAtivo: string | null
  onSalvar: (input: Omit<FluxoAprovadorInput, 'etapa'>) => Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState<FormState>({ setorIds: [] })
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const podeSalvar = Boolean(grupoAtivo) && form.setorIds.length > 0

  async function handleSalvar() {
    if (!podeSalvar) return
    setEnviando(true)
    setErro(null)
    try {
      await onSalvar({
        grupo: grupoAtivo,
        userId: null,
        papelId: null,
        setorIds: form.setorIds,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar a aprovação.')
    } finally {
      setEnviando(false)
    }
  }

  if (!grupoAtivo) {
    return (
      <div className="flex flex-col gap-3 border-t pt-3">
        <p className="text-[11px] text-muted-foreground">
          Selecione uma entidade no filtro acima pra configurar uma aprovação por vários setores.
        </p>
        <Button size="sm" variant="ghost" onClick={onCancelar} className="w-fit">
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">Multiaprovação por setor</Label>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3 w-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="w-64 whitespace-normal text-left">
              Por padrão, só o gestor/coordenador do setor do próprio colaborador aprova essa
              etapa. Isso aqui não é obrigatório pra cada setor — use só quando quiser que mais de
              um setor aprove junto, substituindo essa aprovação padrão.
            </TooltipContent>
          </Tooltip>
        </div>
        <SetoresMultiSelect
          setores={setores}
          selecionados={form.setorIds}
          onChange={(ids) => setForm({ setorIds: ids })}
        />
        {form.setorIds.length > 1 && (
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            Os responsáveis de todos os setores selecionados decidem essa etapa em conjunto —
            inclua o setor do colaborador aqui também, se ele ainda deve fazer parte da aprovação.
          </p>
        )}
      </div>

      {erro && <p className="text-xs text-destructive">{erro}</p>}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSalvar} disabled={!podeSalvar || enviando}>
          Salvar
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

/**
 * Tela "Fluxo de aprovação" (ADMIN, módulo Férias) — configura exceções ao
 * fluxo padrão (PAPEL_POR_ETAPA em feriasFluxo.ts) por grupo de entidade.
 * Ver aviso abaixo: ainda não conectada à decisão real.
 */
export function FluxoAprovacaoAdmin() {
  const { fluxo, isLoading, error, criar, excluir } = useFluxoAprovadores()
  const { setores } = useSetores()
  const { papeis } = usePapeis()
  const { usuario: usuarioLogado } = useUsuarioLogado()
  const [etapaFormAberta, setEtapaFormAberta] = useState<string | null>(null)
  const [grupoFiltro, setGrupoFiltro] = useState<string>(TODAS_ENTIDADES)
  const [grupoFiltroInicializado, setGrupoFiltroInicializado] = useState(false)
  const [etapasOcultas, setEtapasOcultas] = useState<Set<string>>(new Set())
  const [etapasExtras, setEtapasExtras] = useState<string[]>([])
  const [etapaEditando, setEtapaEditando] = useState<string | null>(null)
  const [papelTemp, setPapelTemp] = useState<string>('')
  const [papelPadraoPorEtapa, setPapelPadraoPorEtapa] = useState<Record<string, string>>({})

  // Pré-seleciona a entidade do usuário logado assim que o perfil carrega,
  // mas só uma vez — depois disso o filtro fica livre pra ele trocar.
  useEffect(() => {
    if (grupoFiltroInicializado || !usuarioLogado?.entidadeGrupo) return
    setGrupoFiltro(usuarioLogado.entidadeGrupo)
    setGrupoFiltroInicializado(true)
  }, [usuarioLogado, grupoFiltroInicializado])

  if (error) {
    return <p className="py-6 text-center text-sm text-destructive">{error}</p>
  }
  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
  }

  const grupoAtivo = grupoFiltro === TODAS_ENTIDADES ? null : grupoFiltro

  /** Nome do papel escolhido pra etapa, ou null se nenhum foi definido ainda. */
  function nomePapelDaEtapa(codigo: string): string | null {
    const papelId = papelPadraoPorEtapa[codigo]
    return papelId ? (papeis.find((p) => p.id === papelId)?.nome ?? null) : null
  }

  const etapasCombinadas: EtapaView[] = [
    ...ETAPAS.map((etapa) => ({ ...etapa, extra: false })),
    // Etapas novas (só visuais) não têm nome próprio — o título é sempre o
    // nome do papel escolhido, igual o usuário pediu ("nome da etapa é pra
    // ser o mesmo nome do papel"); sem papel ainda, mostra um placeholder.
    ...etapasExtras.map((codigo) => ({
      codigo,
      titulo: nomePapelDaEtapa(codigo) ?? 'Nova etapa',
      padrao: null,
      extra: true,
    })),
  ]
  const etapasVisiveis = etapasCombinadas.filter((etapa) => !etapasOcultas.has(etapa.codigo))

  function padraoLabel(etapa: EtapaView): string {
    return nomePapelDaEtapa(etapa.codigo) ?? etapa.padrao ?? 'Nenhum papel definido ainda'
  }

  /** Cria uma nova etapa só visual (não existe no fluxo real) e já abre a edição pra escolher o papel. */
  function adicionarEtapa() {
    const codigo = `EXTRA_${Date.now()}`
    setEtapasExtras((prev) => [...prev, codigo])
    setEtapaEditando(codigo)
    setPapelTemp('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Essa configuração ainda não está conectada ao fluxo real de aprovação — por enquanto só
          define a regra pretendida. A aplicação de fato será feita numa etapa seguinte. Editar,
          remover ou adicionar uma etapa abaixo é só uma simulação visual: nada é salvo, e fechar e
          reabrir a tela restaura as 3 etapas originais.
        </p>
      </div>

      {etapasOcultas.size > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 text-muted-foreground"
          onClick={() => setEtapasOcultas(new Set())}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar etapas removidas
        </Button>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Entidade</Label>
        <Select
          value={grupoFiltro}
          onValueChange={(value) => {
            setGrupoFiltro(value)
            setGrupoFiltroInicializado(true)
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODAS_ENTIDADES}>Todas as entidades</SelectItem>
            {GRUPOS_ENTIDADE.map((grupo) => (
              <SelectItem key={grupo} value={grupo}>
                {grupo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Filtra as aprovações exibidas e define o grupo usado ao configurar uma nova aprovação
          por vários setores.
        </p>
      </div>

      {etapasVisiveis.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Todas as etapas foram removidas (só visual) — use "Restaurar etapas removidas" acima.
        </p>
      )}

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex items-start gap-2 pb-3">
          {etapasVisiveis.map((etapa, index) => {
            const excecoesDaEtapa = fluxo.filter(
              (f) =>
                f.etapa === etapa.codigo &&
                (grupoAtivo === null || f.grupo === grupoAtivo || f.userId !== null),
            )
            return (
              <Fragment key={etapa.codigo}>
                <div className="flex w-[253px] shrink-0 flex-col gap-2 whitespace-normal">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    <h4
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm font-semibold',
                        etapa.extra && !nomePapelDaEtapa(etapa.codigo) && 'text-muted-foreground',
                      )}
                    >
                      {etapa.titulo}
                    </h4>
                    {etapaEditando === etapa.codigo ? (
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground"
                          title="Cancelar"
                          onClick={() => {
                            // Etapa extra recém-criada, nunca salva (sem papel
                            // definido) — cancelar descarta ela inteira, não só a edição.
                            if (etapa.extra && !papelPadraoPorEtapa[etapa.codigo]) {
                              setEtapasExtras((prev) => prev.filter((codigo) => codigo !== etapa.codigo))
                            }
                            setEtapaEditando(null)
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-green-600 hover:text-green-700"
                          title="Salvar (só visual, não é salvo)"
                          onClick={() => {
                            setPapelPadraoPorEtapa((prev) => ({ ...prev, [etapa.codigo]: papelTemp }))
                            setEtapaEditando(null)
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                          title="Excluir etapa (só visual, não é salvo)"
                          onClick={() => {
                            setEtapasOcultas((prev) => new Set(prev).add(etapa.codigo))
                            setEtapaEditando(null)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-muted-foreground"
                        title="Editar etapa"
                        onClick={() => {
                          setEtapaEditando(etapa.codigo)
                          setPapelTemp(papelPadraoPorEtapa[etapa.codigo] ?? '')
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 rounded-lg border bg-card p-2.5">
                    {etapaEditando === etapa.codigo ? (
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          {etapa.extra ? 'Papel responsável (também dá nome à etapa)' : 'Papel responsável'}
                        </Label>
                        <Select value={papelTemp} onValueChange={setPapelTemp}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o papel" />
                          </SelectTrigger>
                          <SelectContent>
                            {papeis.map((papel) => (
                              <SelectItem key={papel.id} value={papel.id}>
                                {papel.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="px-0.5 text-xs text-muted-foreground">
                        Padrão: {padraoLabel(etapa)}
                      </p>
                    )}
                    {etapa.extra ? (
                      <p className="px-0.5 text-[11px] text-muted-foreground">
                        Etapa só visual — múltiplas aprovações poderão ser configuradas quando ela
                        for conectada ao fluxo real.
                      </p>
                    ) : (
                      <>
                        {excecoesDaEtapa.map((excecao) => (
                          <ExcecaoCard
                            key={excecao.id}
                            excecao={excecao}
                            onExcluir={() => excluir(excecao.id)}
                          />
                        ))}

                        {etapaFormAberta === etapa.codigo ? (
                          <FormNovaExcecao
                            setores={setores}
                            grupoAtivo={grupoAtivo}
                            onSalvar={async (input) => {
                              await criar({ etapa: etapa.codigo, ...input })
                              setEtapaFormAberta(null)
                            }}
                            onCancelar={() => setEtapaFormAberta(null)}
                          />
                        ) : (
                          <Button
                            size="sm"
                            className="w-fit gap-1.5"
                            onClick={() => setEtapaFormAberta(etapa.codigo)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Adicionar múltipla aprovação
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {index < etapasVisiveis.length - 1 && (
                  <ArrowRight
                    className="mt-7 h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </Fragment>
            )
          })}

          {etapaEditando === null && (
            <>
              {etapasVisiveis.length > 0 && (
                <ArrowRight className="mt-7 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="flex w-[253px] shrink-0 flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">Nova etapa</span>
                <button
                  type="button"
                  onClick={adicionarEtapa}
                  title="Criar nova etapa (só visual, não é salvo)"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground hover:border-blue-400 hover:bg-blue-50/50 hover:text-blue-600 dark:hover:bg-blue-950/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar etapa
                </button>
              </div>
            </>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
