import { Award, BookOpen, Info, Plus, StickyNote } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'

/** Cabeçalho com ícone fixo opcional + título fixo + botão "Adicionar" fixo. */
function SkeletonCardHeader({
  title,
  icon,
  addButton = true,
}: {
  title: string
  icon?: React.ReactNode
  addButton?: boolean
}) {
  return (
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <div className="flex items-center gap-2">
        {icon}
        <CardTitle className="text-lg">{title}</CardTitle>
      </div>
      {addButton && (
        <Button variant="outline" size="sm" className="h-8 gap-1" disabled>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      )}
    </CardHeader>
  )
}

function SkeletonFormacao() {
  return (
    <Card className="shadow-none">
      <SkeletonCardHeader title="Formação acadêmica" />
      <CardContent className="grid gap-6 pt-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-6">
            <div className="flex gap-4">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-56" />
                  <div className="mt-1 flex gap-2">
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-5 w-32 rounded-full" />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 bg-muted text-muted-foreground"
                  disabled
                  aria-hidden
                >
                  <StickyNote className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {index < 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SkeletonCertificacoes() {
  return (
    <Card className="shadow-none">
      <SkeletonCardHeader
        title="Certificações"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            <Award className="h-5 w-5" />
          </div>
        }
      />
      <CardContent className="grid gap-4 pt-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SkeletonWorkshops() {
  return (
    <Card className="shadow-none">
      <SkeletonCardHeader
        title="Cursos e workshops"
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            <BookOpen className="h-5 w-5" />
          </div>
        }
      />
      <CardContent className="grid gap-4 pt-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex flex-col">
            <div className="flex items-center justify-between py-2">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Button
                variant="link"
                className="font-semibold text-brand dark:text-blue-400"
                disabled
              >
                Ver certificado
              </Button>
            </div>
            {index < 2 && <Separator className="mt-2" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function SkeletonIdiomas() {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Idiomas</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled>
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 pt-4">
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>

        <Alert className="border-none bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm">
            Proficiência avaliada pelo teste interno IntegraRH Lang em 15/05/2024.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

/**
 * Skeleton da aba "Pessoal" de /cursos. Mesma regra do skeleton da "Visão geral":
 * só o conteúdo vindo do back-end (ícones de itens, textos dinâmicos, barras de
 * progresso) recebe shimmer; títulos, ícones fixos de cabeçalho, botões e o
 * alerta institucional permanecem.
 */
export function CursosPessoalSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="flex flex-col gap-4 md:col-span-2">
        <SkeletonFormacao />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SkeletonCertificacoes />
          <SkeletonWorkshops />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <SkeletonIdiomas />
      </div>
    </div>
  )
}
