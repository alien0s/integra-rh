import type { LucideIcon } from 'lucide-react'
import { CalendarCheck2, CalendarClock, CalendarRange } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonCardConfig {
  label: string
  valorWidthClass: string
  icon: LucideIcon
}

const cards: SkeletonCardConfig[] = [
  { label: 'Dias disponíveis', valorWidthClass: 'w-10', icon: CalendarCheck2 },
  { label: 'Dias agendados', valorWidthClass: 'w-10', icon: CalendarClock },
  { label: 'Ciclo', valorWidthClass: 'w-32', icon: CalendarRange },
]

/**
 * Skeleton dos três cards de resumo (ver FeriasResumoCards) — mantém rótulo
 * e ícone fixos, só o valor (que vem de GET /ferias/resumo) vira shimmer.
 */
export function FeriasResumoCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ label, valorWidthClass, icon: Icon }) => (
        <Card key={label} className="shadow-none">
          <CardContent className="flex items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </p>
              <Skeleton className={`mt-1.5 h-6 ${valorWidthClass}`} />
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
