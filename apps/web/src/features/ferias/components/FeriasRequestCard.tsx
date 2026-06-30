import { useState } from 'react'
import { addDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'

import type {
  SolicitacaoFerias,
  StatusSolicitacaoFerias,
} from '@/features/ferias/types'

interface FeriasRequestCardProps {
  solicitacao: SolicitacaoFerias
  onAprovar?: (id: string) => void
  onRejeitar?: (id: string, motivo: string) => void
}

/** Rótulo e cores de cada status exibido no topo do card. */
const STATUS_CONFIG: Record<
  StatusSolicitacaoFerias,
  { label: string; className: string }
> = {
  PENDENTE: {
    label: 'Pendente',
    className:
      'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  },
  APROVADA: {
    label: 'Aprovado',
    className:
      'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  },
  REJEITADA: {
    label: 'Rejeitado',
    className:
      'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  },
}

/**
 * Card de solicitação de férias para aprovação/rejeição.
 */
export function FeriasRequestCard({
  solicitacao,
  onAprovar,
  onRejeitar,
}: FeriasRequestCardProps) {
  const {
    id,
    funcionarioNome,
    cicloFerias,
    avatarUrl,
    iniciais,
    dias,
    inicio,
    periodo,
    dataSolicitacao,
    diasRestantes,
    diasTotais,
    status,
  } = solicitacao

  // Período de férias como range para o calendário (somente visualização).
  const inicioFerias = parseISO(inicio)
  const fimFerias = addDays(inicioFerias, Math.max(dias - 1, 0))

  const [rejeicaoAberta, setRejeicaoAberta] = useState(false)
  const [motivo, setMotivo] = useState('')

  function confirmarRejeicao() {
    onRejeitar?.(id, motivo.trim())
    setMotivo('')
    setRejeicaoAberta(false)
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div className="flex flex-col items-start gap-1.5">
          <Badge
            variant="secondary"
            className={STATUS_CONFIG[status].className}
          >
            {STATUS_CONFIG[status].label}
          </Badge>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group -ml-1 flex items-center gap-1 rounded-md px-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Ver período de férias no calendário"
              >
                <CalendarDays className="h-3 w-3" />
                <span className="group-hover:underline">
                  {dias} dias • {periodo}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={{ from: inicioFerias, to: fimFerias }}
                // Controlado + no-op: clicar não altera a seleção (só visualização).
                onSelect={() => {}}
                defaultMonth={inicioFerias}
                locale={ptBR}
                className="rounded-lg [&_[role=gridcell]]:cursor-default"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Solicitado em
          </span>
          <span className="text-xs font-medium">{dataSolicitacao}</span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10 rounded-md">
              <AvatarImage
                src={avatarUrl}
                alt={funcionarioNome}
                className="rounded-md object-cover"
              />
              <AvatarFallback className="rounded-md bg-muted text-xs font-semibold">
                {iniciais}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm font-medium leading-none">
                {funcionarioNome}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                Ciclo {cicloFerias}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-xs text-muted-foreground">
              Dias restantes
            </span>
            <span className="text-sm font-semibold">
              {diasRestantes}/{diasTotais}
            </span>
          </div>
        </div>
      </CardContent>

      {status === 'PENDENTE' && (
        <CardFooter className="justify-end gap-2 pt-0">
          <Dialog open={rejeicaoAberta} onOpenChange={setRejeicaoAberta}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                Rejeitar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Rejeitar solicitação</DialogTitle>
                <DialogDescription>
                  Justifique a rejeição das férias de {funcionarioNome}. A
                  justificativa será registrada na solicitação.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Descreva o motivo da rejeição…"
                className="min-h-28"
                autoFocus
              />
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost" size="sm">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  size="sm"
                  onClick={confirmarRejeicao}
                  disabled={motivo.trim().length === 0}
                  className="border border-red-300 bg-red-600 text-white transition-colors hover:bg-red-700 dark:border-red-900/60 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                >
                  Confirmar rejeição
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            size="sm"
            onClick={() => onAprovar?.(id)}
            className="bg-green-600 text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-500"
          >
            Aprovar
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
