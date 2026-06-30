import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CURSOS_STYLES } from '@/lib/cursos'

/** Barra de 20 segmentos no estado vazio (mantém a cor do card). */
function EmptyStatsBar({ emptyColorClass }: { emptyColorClass: string }) {
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className={`h-5 w-[5px] rounded-sm ${emptyColorClass}`} />
      ))}
    </div>
  )
}

interface SkeletonStatsCardProps {
  title: string
  icon: ReactNode
  iconBgClass: string
  barEmptyColor: string
}

/**
 * Card de estatística em carregamento: mantém ícone, cor e título fixo;
 * apenas os números (valor, total e percentuais) viram skeleton.
 */
function SkeletonStatsCard({
  title,
  icon,
  iconBgClass,
  barEmptyColor,
}: SkeletonStatsCardProps) {
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
          <Skeleton className="h-9 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>

        <EmptyStatsBar emptyColorClass={barEmptyColor} />

        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  )
}

/** Quantidade de "quadrinhos" de curso por linha (espelha a tela real). */
const CURSOS_POR_LINHA = [4, 3, 5, 2]

/**
 * Skeleton da aba "Visão geral" de /cursos. Dá a sensação de carregamento
 * rápido: só os dados vindos do back-end (números, avatares, textos dinâmicos)
 * recebem shimmer; títulos, rótulos e cabeçalhos fixos permanecem.
 */
export function CursosOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* 3 cards — cores preservadas, somente os números em skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonStatsCard
          title="Pessoas formadas"
          icon={
            <CURSOS_STYLES.FORMADOS.icon
              className={`h-4 w-4 ${CURSOS_STYLES.FORMADOS.textClass}`}
            />
          }
          iconBgClass={CURSOS_STYLES.FORMADOS.bgClass}
          barEmptyColor={CURSOS_STYLES.FORMADOS.barEmptyClass}
        />
        <SkeletonStatsCard
          title="Pessoas em formação"
          icon={
            <CURSOS_STYLES.EM_FORMACAO.icon
              className={`h-4 w-4 ${CURSOS_STYLES.EM_FORMACAO.textClass}`}
            />
          }
          iconBgClass={CURSOS_STYLES.EM_FORMACAO.bgClass}
          barEmptyColor={CURSOS_STYLES.EM_FORMACAO.barEmptyClass}
        />
        <SkeletonStatsCard
          title="Cursos rápidos"
          icon={
            <CURSOS_STYLES.CURSOS_RAPIDOS.icon
              className={`h-4 w-4 ${CURSOS_STYLES.CURSOS_RAPIDOS.textClass}`}
            />
          }
          iconBgClass={CURSOS_STYLES.CURSOS_RAPIDOS.bgClass}
          barEmptyColor={CURSOS_STYLES.CURSOS_RAPIDOS.barEmptyClass}
        />
      </div>

      {/* Tabela de funcionários — 4 linhas em skeleton */}
      <Card className="overflow-hidden shadow-none">
        <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Funcionários</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Pesquisar"
              disabled
              className="w-full bg-white pl-8 shadow-none"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-6">Nome</TableHead>
                <TableHead className="h-11">Departamento</TableHead>
                <TableHead className="h-11">Cursos</TableHead>
                <TableHead className="h-11 w-24 pr-6 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CURSOS_POR_LINHA.map((quantidade, linha) => (
                <TableRow key={linha} className="hover:bg-transparent">
                  <TableCell className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="grid gap-1.5">
                        <Skeleton className="h-3.5 w-36" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: quantidade }).map((_, i) => (
                        <Skeleton key={i} className="h-7 w-7 rounded-md" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <Skeleton className="ml-auto h-4 w-6" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
