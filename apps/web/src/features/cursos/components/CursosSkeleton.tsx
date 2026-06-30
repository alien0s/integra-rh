import { TabsContent } from '@/components/ui/tabs'
import { CursosOverviewSkeleton } from './CursosOverviewSkeleton'
import { CursosPessoalSkeleton } from './CursosPessoalSkeleton'

/**
 * Estado de carregamento de /cursos. Espelha a estrutura de abas de
 * CursosOverview para que o skeleton exibido siga a aba ativa.
 */
export function CursosSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <TabsContent value="visao-geral">
        <CursosOverviewSkeleton />
      </TabsContent>

      <TabsContent value="pessoal">
        <CursosPessoalSkeleton />
      </TabsContent>
    </div>
  )
}
