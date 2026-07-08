import { Grid2x2Check, Users } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppLayout } from '@/features/app/components'
import { FeriasOverview, FeriasPessoal } from '@/features/ferias/components'
import { useFerias } from '@/features/ferias/hooks'

/**
 * Página de Férias. A aba "Visão geral" lista as solicitações pendentes.
 */
export function FeriasList() {
  const { solicitacoes, aprovar, rejeitar } = useFerias()

  return (
    <Tabs defaultValue="visao-geral" className="flex flex-col w-full">
      <AppLayout
        title="Férias"
        description="Home / Gestão de Pessoas / Férias"
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
        <TabsContent value="visao-geral">
          <FeriasOverview
            solicitacoes={solicitacoes}
            onAprovar={aprovar}
            onRejeitar={rejeitar}
          />
        </TabsContent>

        <TabsContent value="pessoal">
          <FeriasPessoal />
        </TabsContent>
      </AppLayout>
    </Tabs>
  )
}
