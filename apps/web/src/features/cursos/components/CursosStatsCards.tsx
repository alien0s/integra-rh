import type { ReactNode } from 'react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CURSOS_STYLES } from '@/lib/cursos'
import type { QualificacoesResumo, StatsCardData } from '../types'

interface StatsBarProps {
  filled: number
  total: number
  colorClass: string
  emptyColorClass: string
}

function StatsBar({ filled, total, colorClass, emptyColorClass }: StatsBarProps) {
  const segments = 20
  const filledSegments = Math.round((filled / total) * segments)

  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-5 w-[5px] rounded-sm transition-colors ${
            i < filledSegments ? colorClass : emptyColorClass
          }`}
        />
      ))}
    </div>
  )
}

interface SingleStatsCardProps {
  title: string
  icon: ReactNode
  data: StatsCardData
  barColor: string
  barEmptyColor: string
  iconBgClass: string
  label: string
  availableLabel: string
}

function SingleStatsCard({
  title,
  icon,
  data,
  barColor,
  barEmptyColor,
  iconBgClass,
  label,
  availableLabel,
}: SingleStatsCardProps) {
  const percentage = Math.round((data.count / data.total) * 100)
  const remaining = data.total - data.count

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBgClass}`}
          >
            {icon}
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight">{data.count}</span>
          <span className="text-sm text-muted-foreground">
            / {data.total} colaboradores
          </span>
        </div>

        <Tooltip>
          <TooltipTrigger>
            <StatsBar
              filled={data.count}
              total={data.total}
              colorClass={barColor}
              emptyColorClass={barEmptyColor}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {percentage}% do total de colaboradores
          </TooltipContent>
        </Tooltip>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {percentage}% {label}
          </span>
          <span>
            {remaining} {availableLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

interface CursosStatsCardsProps {
  data: QualificacoesResumo
}

/**
 * Exibe três cards de overview com estatísticas de formação dos colaboradores.
 */
export function CursosStatsCards({ data }: CursosStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SingleStatsCard
        title="Pessoas formadas"
        icon={<CURSOS_STYLES.FORMADOS.icon className={`h-4 w-4 ${CURSOS_STYLES.FORMADOS.textClass}`} />}
        iconBgClass={CURSOS_STYLES.FORMADOS.bgClass}
        data={data.formados}
        barColor={CURSOS_STYLES.FORMADOS.barClass}
        barEmptyColor={CURSOS_STYLES.FORMADOS.barEmptyClass}
        label="formados"
        availableLabel="sem formação"
      />
      <SingleStatsCard
        title="Pessoas em formação"
        icon={<CURSOS_STYLES.EM_FORMACAO.icon className={`h-4 w-4 ${CURSOS_STYLES.EM_FORMACAO.textClass}`} />}
        iconBgClass={CURSOS_STYLES.EM_FORMACAO.bgClass}
        data={data.emFormacao}
        barColor={CURSOS_STYLES.EM_FORMACAO.barClass}
        barEmptyColor={CURSOS_STYLES.EM_FORMACAO.barEmptyClass}
        label="em curso"
        availableLabel="fora de curso"
      />
      <SingleStatsCard
        title="Cursos rápidos"
        icon={<CURSOS_STYLES.CURSOS_RAPIDOS.icon className={`h-4 w-4 ${CURSOS_STYLES.CURSOS_RAPIDOS.textClass}`} />}
        iconBgClass={CURSOS_STYLES.CURSOS_RAPIDOS.bgClass}
        data={data.cursosRapidos}
        barColor={CURSOS_STYLES.CURSOS_RAPIDOS.barClass}
        barEmptyColor={CURSOS_STYLES.CURSOS_RAPIDOS.barEmptyClass}
        label="com cursos"
        availableLabel="sem cursos"
      />
    </div>
  )
}
