import { ArrowRight, Ellipsis, Info } from 'lucide-react'

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
}

/** Cores do badge de status por situação. */
const statusClassName: Record<StatusMinhaSolicitacao, string> = {
  APROVADO:
    'border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400',
  PENDENTE:
    'border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  RECUSADO:
    'border-transparent bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400',
}

/**
 * Histórico das solicitações do colaborador + lembrete de política.
 */
export function HistoricoSolicitacoes({
  solicitacoes,
}: HistoricoSolicitacoesProps) {
  return (
    <div className="flex flex-col gap-4">
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
                    <p className="font-medium leading-snug">{s.periodo}</p>
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
                      {s.status}
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
                          disabled={s.status !== 'PENDENTE'}
                          className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                        >
                          Cancelar
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
            As solicitações devem ser feitas com no mínimo 30 dias de
            antecedência. Em caso de dúvidas, consulte o Guia do Colaborador no
            menu de ajuda.
          </p>
        </div>
      </div>
    </div>
  )
}
