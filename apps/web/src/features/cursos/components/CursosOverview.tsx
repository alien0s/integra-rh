import { TabsContent } from '@/components/ui/tabs'
import type { useCursos } from '@/features/cursos/hooks'
import { Certificacoes } from '@/features/cursos/components/Certificacoes'
import { CursosStatsCards } from '@/features/cursos/components/CursosStatsCards'
import { CursosWorkshops } from '@/features/cursos/components/CursosWorkshops'
import { FormacaoAcademica } from '@/features/cursos/components/FormacaoAcademica'
import { FuncionariosCursosSuperioresTable } from '@/features/cursos/components/FuncionariosCursosSuperioresTable'
import { Idiomas } from '@/features/cursos/components/Idiomas'

interface CursosOverviewProps {
  data: ReturnType<typeof useCursos>
}

/**
 * Conteúdo principal da tela de cursos e qualificações.
 */
export function CursosOverview({ data }: CursosOverviewProps) {
  const certificacoes = data.cursos.filter((item) => item.tipo === 'CERTIFICACAO')
  const cursosWorkshops = data.cursos.filter((item) => item.tipo !== 'CERTIFICACAO')

  return (
    <div className="flex flex-col gap-6">
      <TabsContent value="visao-geral">
        <div className="flex flex-col gap-4">
          {data.resumo && <CursosStatsCards data={data.resumo} />}
          <FuncionariosCursosSuperioresTable data={data.funcionarios} />
        </div>
      </TabsContent>

      <TabsContent value="pessoal">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-4 md:col-span-2">
            <FormacaoAcademica
              data={data.formacoes}
              onCriar={data.criarFormacao}
              onExcluir={data.excluirFormacao}
            />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Certificacoes
                data={certificacoes}
                onCriar={data.criarCurso}
                onExcluir={data.excluirCurso}
              />
              <CursosWorkshops
                data={cursosWorkshops}
                onCriar={data.criarCurso}
                onExcluir={data.excluirCurso}
              />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <Idiomas
              data={data.idiomas}
              onCriar={data.criarOuAtualizarIdioma}
              onExcluir={data.excluirIdioma}
            />
          </div>
        </div>
      </TabsContent>
    </div>
  )
}
