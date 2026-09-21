import { useState } from 'react'
import { ArrowRight, Ellipsis, Info, PencilLine } from 'lucide-react'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import type {
  MinhaSolicitacao,
  StatusMinhaSolicitacao,
} from '@/features/ferias/types'

interface HistoricoSolicitacoesProps {
  solicitacoes: MinhaSolicitacao[]
  /** Cancela uma solicitação própria (enquanto não confirmada). */
  onCancelar?: (id: string) => void
  /** Exclui do histórico uma solicitação já cancelada. */
  onExcluir?: (id: string) => Promise<unknown> | void
  /** Aceita o ajuste de data sugerido pelo DP (status AJUSTE_SUGERIDO). */
  onAceitarAjuste?: (id: string) => Promise<unknown> | void
}

/** Cores do badge de status por situação. */
const statusClassName: Record<StatusMinhaSolicitacao, string> = {
  APROVADO:
    'border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
  APROVADO_GESTOR:
    'border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  AJUSTE_SUGERIDO:
    'border-transparent bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  PENDENTE:
    'border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  RECUSADO:
    'border-transparent bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  CANCELADO:
    'border-transparent bg-muted text-muted-foreground hover:bg-muted',
}

/** Rótulo legível de cada status no histórico. */
const statusLabel: Record<StatusMinhaSolicitacao, string> = {
  PENDENTE: 'Aguardando gestor',
  APROVADO_GESTOR: 'Aguardando DP',
  AJUSTE_SUGERIDO: 'Ajuste sugerido',
  APROVADO: 'Aprovado',
  RECUSADO: 'Recusado',
  CANCELADO: 'Cancelado',
}

/**
 * Enquanto não confirmada (nem recusada/cancelada), o colaborador pode
 * cancelar — inclui AJUSTE_SUGERIDO: se não concorda com a data proposta
 * pelo DP, cancela a solicitação inteira (não há uma "recusa do ajuste").
 */
function podeCancelar(status: StatusMinhaSolicitacao): boolean {
  return (
    status === 'PENDENTE' ||
    status === 'APROVADO_GESTOR' ||
    status === 'AJUSTE_SUGERIDO'
  )
}

/** Só dá pra excluir do histórico depois de cancelada (regra também no backend). */
function podeExcluir(status: StatusMinhaSolicitacao): boolean {
  return status === 'CANCELADO'
}

/**
 * Histórico das solicitações do colaborador + lembrete de política.
 */
export function HistoricoSolicitacoes({
  solicitacoes,
  onCancelar,
  onExcluir,
  onAceitarAjuste,
}: HistoricoSolicitacoesProps) {
  // Solicitação aguardando confirmação de exclusão (null = dialog fechado).
  const [paraExcluir, setParaExcluir] = useState<MinhaSolicitacao | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  // ID da solicitação cujo ajuste está sendo aceito (evita cliques duplicados).
  const [aceitandoId, setAceitandoId] = useState<string | null>(null)

  async function confirmarExclusao() {
    if (!paraExcluir) return
    setExcluindo(true)
    try {
      await onExcluir?.(paraExcluir.id)
      setParaExcluir(null)
    } catch (erro) {
      console.error(erro)
    } finally {
      setExcluindo(false)
    }
  }

  async function aceitarAjuste(id: string) {
    setAceitandoId(id)
    try {
      await onAceitarAjuste?.(id)
    } catch (erro) {
      console.error(erro)
    } finally {
      setAceitandoId(null)
    }
  }

  const comAjusteSugerido = solicitacoes.filter((s) => s.status === 'AJUSTE_SUGERIDO')

  return (
    <div className="flex flex-col gap-4">
      {/* Ajuste sugerido pelo DP — aguarda o "OK" do colaborador. Não existe
          "recusar o ajuste": pra isso, cancela a solicitação (menu Ações). */}
      {comAjusteSugerido.map((s) => (
        <div
          key={s.id}
          className="flex gap-3 rounded-lg border border-orange-200 bg-orange-50 p-4 dark:border-orange-900/50 dark:bg-orange-900/20"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
            <PencilLine className="h-5 w-5" />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div>
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                O DP sugeriu um ajuste de data
              </p>
              <p className="mt-0.5 text-sm text-orange-700/80 dark:text-orange-300/80">
                De <span className="line-through">{s.periodo}</span> para{' '}
                <span className="font-medium">{s.periodoSugerido}</span>.
                {s.motivoAjuste ? ` Motivo: ${s.motivoAjuste}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="bg-orange-600 text-white transition-colors hover:bg-orange-700 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-500"
                disabled={aceitandoId === s.id}
                onClick={() => aceitarAjuste(s.id)}
              >
                {aceitandoId === s.id ? 'Aceitando…' : 'OK, aceitar novo período'}
              </Button>
              <span className="text-xs text-orange-700/70 dark:text-orange-300/70">
                Não concorda? Cancele a solicitação no menu ao lado.
              </span>
            </div>
          </div>
        </div>
      ))}

      <Card className="overflow-hidden shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Histórico de Solicitações</CardTitle>
          <Button
            variant="link"
            size="sm"
            className="h-auto gap-1 p-0 text-blue-600 dark:text-blue-400"
          >
            Ver todas
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-6">Período</TableHead>
                <TableHead className="h-11">Tipo</TableHead>
                <TableHead className="h-11">Status</TableHead>
                <TableHead className="h-11 w-16 pr-6 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitacoes.map((s) => (
                <TableRow key={s.id} className="hover:bg-muted/50">
                  <TableCell className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium leading-snug">{s.periodo}</p>
                      {s.origem === 'REGISTRO_MANUAL' && (
                        <Badge
                          variant="outline"
                          className="rounded px-1.5 py-0 text-[10px] font-normal text-muted-foreground"
                        >
                          Lançado manualmente
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.detalhe}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.tipo}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`rounded-lg px-2 py-1 text-xs font-medium shadow-none ${statusClassName[s.status]}`}
                    >
                      {statusLabel[s.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          aria-label="Ações"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem>Ver detalhes</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!podeCancelar(s.status)}
                          onSelect={() => podeCancelar(s.status) && onCancelar?.(s.id)}
                          className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                        >
                          Cancelar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!podeExcluir(s.status)}
                          onSelect={() => podeExcluir(s.status) && setParaExcluir(s)}
                          className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Lembrete de política */}
      <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-900/20">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
          <Info className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
            Lembrete de Política
          </p>
          <p className="mt-0.5 text-sm text-blue-700/80 dark:text-blue-300/80">
            As solicitações devem ser feitas com no mínimo 40 dias de
            antecedência, e as férias não podem começar em sexta, sábado ou
            domingo. Em caso de dúvidas, consulte o Guia do Colaborador no menu
            de ajuda.
          </p>
        </div>
      </div>

      <AlertDialog
        open={paraExcluir !== null}
        onOpenChange={(aberto) => {
          if (!aberto && !excluindo) setParaExcluir(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a solicitação de{' '}
              <span className="font-medium text-foreground">
                {paraExcluir?.periodo}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white transition-colors hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
              disabled={excluindo}
              onClick={(event) => {
                event.preventDefault()
                confirmarExclusao()
              }}
            >
              {excluindo ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
