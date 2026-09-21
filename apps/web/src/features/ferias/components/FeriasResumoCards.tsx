import type { LucideIcon } from 'lucide-react'
import { CalendarCheck2, CalendarClock, CalendarRange } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'

import type { FeriasResumo } from '@/features/ferias/types'

interface FeriasResumoCardsProps {
  resumo: FeriasResumo
}

interface CardConfig {
  label: string
  valor: string
  icon: LucideIcon
}

/**
 * Três cards de resumo do saldo de férias (disponíveis, agendados, período).
 */
export function FeriasResumoCards({ resumo }: FeriasResumoCardsProps) {
  const cards: CardConfig[] = [
    { label: 'Dias disponíveis', valor: String(resumo.diasDisponiveis).padStart(2, '0'), icon: CalendarCheck2 },
    { label: 'Dias agendados', valor: String(resumo.diasAgendados).padStart(2, '0'), icon: CalendarClock },
    { label: 'Ciclo', valor: resumo.periodoAquisitivo, icon: CalendarRange },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ label, valor, icon: Icon }) => (
        <Card key={label} className="shadow-none">
          <CardContent className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <p className="mt-0.5 truncate text-2xl font-bold tracking-tight">
                {valor}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Icon className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
