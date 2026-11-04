import { AppLayout } from '@/features/app/components/AppLayout'
import {
  CursosOverview,
  CursosSkeleton,
  QualificacoesPendentesDialog,
} from '@/features/cursos/components'
import { useCursos } from '@/features/cursos/hooks'
import { useAuth } from '@/features/auth/context'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Grid2x2Check, Users } from 'lucide-react'

/**
 * Papéis com permissão pra ver a aba "Visão geral" (estatísticas + tabela de
 * funcionários) e moderar qualificações (aprovar/recusar diploma e cursos)
 * — mesma regra do backend, ver PAPEIS_RH/ehRh em qualificacoes.routes.ts.
 * Mesmo conjunto de papéis já usado em férias (PAPEIS_DP_RH, ver
 * FeriasOverview.tsx).
 */
const PAPEIS_DP_RH = new Set(['ADMIN', 'RH', 'DP', 'COORDENADOR DP'])

/**
 * Página de composição da área de cursos e qualificações.
 */
export function CursosList() {
  const cursos = useCursos()
  const { usuario } = useAuth()
  const ehDpRh = Boolean(usuario?.papelCodigo && PAPEIS_DP_RH.has(usuario.papelCodigo))

  return (
    <Tabs defaultValue={ehDpRh ? 'visao-geral' : 'pessoal'} className="flex flex-col w-full">
      <AppLayout
        title="Cursos e Formação"
        description="Home / Gestão de Pessoas / Cursos e Formação"
        // Só mostra a barra de abas (e o botão "Pendentes") pra quem tem mais
        // de 1 aba disponível — pra quem só vê "Pessoal" (todo mundo fora de
        // PAPEIS_DP_RH), a barra não aparece: uma aba única não é navegação,
        // é só ruído visual (ver skill-estrutura.md, "Abas condicionadas por
        // papel" — mesma regra que `FeriasList.tsx` já segue).
        actions={
          ehDpRh ? (
            <div className="flex items-center gap-2">
              <QualificacoesPendentesDialog />
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
            </div>
          ) : undefined
        }
      >
        {cursos.isLoading ? <CursosSkeleton /> : <CursosOverview data={cursos} />}
      </AppLayout>
    </Tabs>
  )
}
