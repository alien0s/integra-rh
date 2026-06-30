import { AppLayout } from '@/features/app/components/AppLayout'
import {
  CursosOverview,
  CursosSkeleton,
} from '@/features/cursos/components'
import { useCursos } from '@/features/cursos/hooks'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Grid2x2Check, Users } from 'lucide-react'

/**
 * Página de composição da área de cursos e qualificações.
 */
export function CursosList() {
  const { data, isLoading } = useCursos()

  return (
    <Tabs defaultValue="visao-geral" className="flex flex-col w-full">
      <AppLayout
        title="Cursos e Formação"
        description="Home / Gestão de Pessoas / Cursos e Formação"
        actions={
          <TabsList className="h-9">
            <TabsTrigger value="visao-geral" className="px-5">
              <Grid2x2Check className="mr-2 h-4 w-4" />
              Visão geral
            </TabsTrigger>
            <TabsTrigger value="pessoal" className="px-5">
              <Users className="mr-2 h-4 w-4" />
              Pessoal
            </TabsTrigger>
          </TabsList>
        }
      >
        {isLoading || !data ? <CursosSkeleton /> : <CursosOverview data={data} />}
      </AppLayout>
    </Tabs>
  )
}
