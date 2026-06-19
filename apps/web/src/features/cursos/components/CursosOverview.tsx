import type { CursosData } from '@/features/cursos/types'

import { Certificacoes } from '@/features/cursos/components/Certificacoes'
import { CursosStatsCards } from '@/features/cursos/components/CursosStatsCards'
import { CursosWorkshops } from '@/features/cursos/components/CursosWorkshops'
import { FormacaoAcademica } from '@/features/cursos/components/FormacaoAcademica'
import { FuncionariosCursosSuperioresTable } from '@/features/cursos/components/FuncionariosCursosSuperioresTable'
import { Idiomas } from '@/features/cursos/components/Idiomas'
import { TabsContent } from '@/components/ui/tabs'

interface CursosOverviewProps {
  data: CursosData
}

/**
 * Conteúdo principal da tela de cursos e qualificações.
 */
export function CursosOverview({ data }: CursosOverviewProps) {
  return (
    <div className="flex flex-col gap-6">

      <TabsContent value="visao-geral">
        <div className="flex flex-col gap-4">
          <CursosStatsCards data={data.stats} />
          <FuncionariosCursosSuperioresTable
            data={data.funcionariosCursosSuperiores}
          />
        </div>
      </TabsContent>

      <TabsContent value="pessoal">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-4 md:col-span-2">
            <FormacaoAcademica data={data.formacoes} />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Certificacoes data={data.certificacoes} />
              <CursosWorkshops data={data.cursos} />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Idiomas data={data.idiomas} />
          </div>
        </div>
      </TabsContent>
    </div>
  )
}

