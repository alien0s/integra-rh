import { CalendarDays } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

import type {
  Marcacao,
  RegistroPonto,
  StatusMarcacao,
} from '@/features/ponto/types'

interface PontoTableProps {
  registros: RegistroPonto[]
  selecionados: Set<string>
  onAlternar: (id: string, marcado: boolean) => void
  onAlternarTodos: (marcado: boolean) => void
}

/** Cor de fundo/texto da célula por status da marcação. */
const bgStatus: Record<StatusMarcacao, string> = {
  ok: 'bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400',
  alerta: 'bg-amber-100/80 text-amber-700 dark:bg-amber-900/25 dark:text-amber-400',
  erro: 'bg-red-100/80 text-red-600 dark:bg-red-900/25 dark:text-red-400',
  vazio: 'text-muted-foreground',
}

/** Célula de horário colorida conforme o status da marcação. */
function CelulaMarcacao({ marcacao }: { marcacao: Marcacao }) {
  return (
    <TableCell
      className={cn('text-center text-sm font-medium', bgStatus[marcacao.status])}
    >
      {marcacao.valor}
    </TableCell>
  )
}

/**
 * Tabela de registros de ponto (jornada), com seleção por linha e células
 * coloridas por status (verde = ok, âmbar = alerta, vermelho = erro).
 */
export function PontoTable({
  registros,
  selecionados,
  onAlternar,
  onAlternarTodos,
}: PontoTableProps) {
  const total = registros.length
  const marcados = selecionados.size
  const estadoTodos: boolean | 'indeterminate' =
    marcados === 0 ? false : marcados === total ? true : 'indeterminate'

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 w-12 pl-6">
                <Checkbox
                  checked={estadoTodos}
                  onCheckedChange={(c) => onAlternarTodos(c === true)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
              <TableHead className="h-11">Funcionário</TableHead>
              <TableHead className="h-11">
                <span className="inline-flex items-center gap-2">
                  Data
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </span>
              </TableHead>
              <TableHead className="h-11">Jornada</TableHead>
              <TableHead className="h-11 text-center">Entrada</TableHead>
              <TableHead className="h-11 text-center">Intervalo</TableHead>
              <TableHead className="h-11 text-center">Fim intervalo</TableHead>
              <TableHead className="h-11 text-center">Saída</TableHead>
              <TableHead className="h-11 pr-6 text-center">Trabalhado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.map((r) => {
              const marcado = selecionados.has(r.id)
              return (
                <TableRow key={r.id} className="hover:bg-transparent">
                  <TableCell className="pl-6">
                    <Checkbox
                      checked={marcado}
                      onCheckedChange={(c) => onAlternar(r.id, c === true)}
                      aria-label={`Selecionar ${r.diaSemana} ${r.data}`}
                    />
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 rounded-lg">
                        <AvatarImage
                          src={r.funcionario.fotoUrl}
                          alt={r.funcionario.nome}
                          className="rounded-lg"
                        />
                        <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          {r.funcionario.iniciais}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium leading-none">
                        {r.funcionario.nome}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span
                      className={cn(
                        'font-semibold',
                        r.fimDeSemana && 'text-muted-foreground',
                      )}
                    >
                      {r.diaSemana}
                    </span>{' '}
                    <span className="text-muted-foreground">{r.data}</span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-sm',
                      r.fimDeSemana ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {r.jornada}
                  </TableCell>
                  <CelulaMarcacao marcacao={r.entrada} />
                  <CelulaMarcacao marcacao={r.intervalo} />
                  <CelulaMarcacao marcacao={r.fimIntervalo} />
                  <CelulaMarcacao marcacao={r.saida} />
                  <TableCell className="pr-6 text-center text-sm font-semibold">
                    {r.trabalhado}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
