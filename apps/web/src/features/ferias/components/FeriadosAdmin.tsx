import { useMemo, useState, type ComponentProps } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Download, Landmark, Loader2, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { rotuloTipoFeriado } from '@/features/ferias/constants'
import { useFeriados } from '@/features/ferias/hooks'
import type { Feriado } from '@/features/ferias/types'
import { FeriadoDiaDialog } from './FeriadoDiaDialog'

/** Anos oferecidos no seletor (ano anterior até +2). */
function anosDisponiveis(): number[] {
  const atual = new Date().getFullYear()
  return [atual - 1, atual, atual + 1, atual + 2]
}

/** "YYYY-MM-DD" → Date local (sem susto de fuso). */
function dataLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

/**
 * Tela do DP (aba "Feriados"): calendário do ANO inteiro (12 meses) com os
 * feriados destacados. Clicar num dia abre o editor (`FeriadoDiaDialog`) para
 * cadastrar/editar/excluir o feriado daquele dia. Também importa os feriados
 * nacionais do ano via BrasilAPI. Reusa o `Calendar` do shadcn.
 */
export function FeriadosAdmin() {
  const [ano, setAno] = useState(() => new Date().getFullYear())
  const [importando, setImportando] = useState(false)
  const [importandoLegado, setImportandoLegado] = useState(false)
  // Dia clicado no calendário (abre o editor); `null` = editor fechado.
  const [diaSel, setDiaSel] = useState<Date | null>(null)
  // Confirmação de exclusão de TODOS os feriados do ano selecionado.
  const [confirmarExclusaoAno, setConfirmarExclusaoAno] = useState(false)
  const [excluindoAno, setExcluindoAno] = useState(false)
  const {
    feriados,
    isLoading,
    error,
    criar,
    atualizar,
    excluir,
    excluirTodosDoAno,
    importar,
    importarLegado,
  } = useFeriados(ano)

  // Índice por data (YYYY-MM-DD) para achar o feriado de um dia, e a lista de
  // Dates usada para destacar os dias de feriado no calendário.
  const { porData, datas } = useMemo(() => {
    const mapa = new Map<string, Feriado>()
    for (const f of feriados) mapa.set(f.data, f)
    return { porData: mapa, datas: feriados.map((f) => dataLocal(f.data)) }
  }, [feriados])

  // Feriado do dia atualmente selecionado (para o editor abrir em modo edição).
  const chaveSel = diaSel ? format(diaSel, 'yyyy-MM-dd') : null
  const feriadoSel = chaveSel ? porData.get(chaveSel) : undefined

  // DayButton customizado: nos dias de feriado, envolve o botão do dia num
  // tooltip (hover) com o nome e o tipo. Nos demais dias, usa o botão padrão.
  // Memoizado por `porData` para não recriar o componente a cada render.
  const DiaComTooltip = useMemo(() => {
    return function DiaComTooltip(
      props: ComponentProps<typeof CalendarDayButton>,
    ) {
      const f = porData.get(format(props.day.date, 'yyyy-MM-dd'))
      const botao = <CalendarDayButton {...props} locale={ptBR} />
      if (!f) return botao
      return (
        <Tooltip className="w-full">
          <TooltipTrigger>{botao}</TooltipTrigger>
          <TooltipContent>
            {f.nome} · {rotuloTipoFeriado(f.tipo)}
          </TooltipContent>
        </Tooltip>
      )
    }
  }, [porData])

  /**
   * Exclui TODOS os feriados do ano selecionado (após confirmação no dialog).
   * Útil para zerar o ano antes de reimportar do zero.
   */
  async function handleExcluirAno() {
    setExcluindoAno(true)
    try {
      const removidos = await excluirTodosDoAno()
      toast({
        title: `Feriados de ${ano} excluídos`,
        description: `${removidos} feriado(s) removido(s).`,
        duration: 4000,
      })
      setConfirmarExclusaoAno(false)
    } catch (e) {
      toast({
        title: 'Falha ao excluir feriados',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setExcluindoAno(false)
    }
  }

  /** Importa os feriados nacionais do ano (BrasilAPI) e avisa por toast. */
  async function handleImportar() {
    setImportando(true)
    try {
      const { inseridos, total } = await importar()
      toast({
        title: `Feriados de ${ano} importados`,
        description: `${inseridos} novo(s) de ${total} nacionais (BrasilAPI).`,
        duration: 4000,
      })
    } catch (e) {
      toast({
        title: 'Falha ao importar feriados',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }

  /** Importa os municipais/estaduais do ano do legado (APS) e avisa por toast. */
  async function handleImportarLegado() {
    setImportandoLegado(true)
    try {
      const { inseridos, total } = await importarLegado()
      toast({
        title: `Feriados de ${ano} importados`,
        description: `${inseridos} novo(s) de ${total} municipais/estaduais (APS).`,
        duration: 4000,
      })
    } catch (e) {
      toast({
        title: 'Falha ao importar feriados do legado',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setImportandoLegado(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra superior: seletor de ano + contador + importação. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="h-9 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosDisponiveis().map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="ml-1 hidden text-xs text-muted-foreground sm:inline">
            Clique num dia para cadastrar ou editar um feriado.
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Contador de feriados do ano, agora clicável: abre a confirmação
              para excluir todos os feriados de {ano} (ex.: para reimportar). */}
          <Button
            variant="outline"
            onClick={() => setConfirmarExclusaoAno(true)}
            disabled={feriados.length === 0}
          >
            <span className="inline-block h-3 w-3 rounded-sm bg-red-200 dark:bg-red-900/50" />
            {feriados.length} feriado(s)
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={handleImportar} disabled={importando}>
            <Download className="h-4 w-4" />
            {importando ? 'Importando…' : `Importar nacionais de ${ano}`}
          </Button>
          <Button
            variant="outline"
            onClick={handleImportarLegado}
            disabled={importandoLegado}
          >
            <Landmark className="h-4 w-4" />
            {importandoLegado ? 'Importando…' : `Importar do legado (APS) de ${ano}`}
          </Button>
        </div>
      </div>

      {/* Calendário do ano inteiro (12 meses). `isolate` cria um novo contexto
          de empilhamento: os dias do calendário usam z-10/z-20 internamente e,
          sem isso, "vazam" por cima do header fixo (sticky z-10) ao rolar. */}
      <div className="relative isolate rounded-lg border p-3">
        {error ? (
          <p className="py-10 text-center text-sm text-destructive">{error}</p>
        ) : isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <Calendar
            // Remonta ao trocar de ano para reposicionar em janeiro.
            key={ano}
            mode="single"
            selected={diaSel ?? undefined}
            onSelect={(dia) => setDiaSel(dia ?? null)}
            numberOfMonths={12}
            defaultMonth={new Date(ano, 0, 1)}
            startMonth={new Date(ano, 0, 1)}
            endMonth={new Date(ano, 11, 1)}
            hideNavigation
            showOutsideDays={false}
            locale={ptBR}
            // Destaca os dias de feriado em vermelho.
            modifiers={{ feriado: datas }}
            modifiersClassNames={{
              feriado:
                'bg-red-100 text-red-700 font-medium rounded-md dark:bg-red-900/40 dark:text-red-300',
            }}
            // DayButton com tooltip nos feriados.
            components={{ DayButton: DiaComTooltip }}
            // Fonte/células menores para caber o ano inteiro; 12 meses em grade.
            className="w-full text-xs [--cell-size:--spacing(7)]"
            classNames={{
              months:
                'grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
              month: 'flex flex-col gap-2',
              month_caption:
                'flex h-7 w-full items-center justify-center text-sm font-semibold capitalize',
            }}
          />
        )}
      </div>

      {/* Editor do dia clicado (cadastra/edita/exclui). */}
      <FeriadoDiaDialog
        dia={diaSel}
        feriado={feriadoSel}
        onFechar={() => setDiaSel(null)}
        onCriar={criar}
        onAtualizar={atualizar}
        onExcluir={excluir}
      />

      {/* Confirmação de exclusão de TODOS os feriados do ano selecionado. */}
      <AlertDialog
        open={confirmarExclusaoAno}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindoAno) setConfirmarExclusaoAno(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir feriados de {ano}</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir os{' '}
              <span className="font-medium text-foreground">
                {feriados.length} feriado(s)
              </span>{' '}
              cadastrados em {ano}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindoAno}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
              disabled={excluindoAno}
              onClick={(event) => {
                event.preventDefault()
                handleExcluirAno()
              }}
            >
              {excluindoAno ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {excluindoAno ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
