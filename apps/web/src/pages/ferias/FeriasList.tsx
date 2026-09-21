import { useState } from 'react'
import { CalendarDays, Grid2x2Check, Users } from 'lucide-react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppLayout } from '@/features/app/components'
import { useAuth } from '@/features/auth/context'
import {
  FeriadosAdmin,
  FeriasOverview,
  FeriasPessoal,
} from '@/features/ferias/components'
import { useFerias } from '@/features/ferias/hooks'

/** Papéis que podem gerir o mapa de feriados (aba "Feriados"). */
const PAPEIS_FERIADOS = new Set(['DP', 'COORDENADOR DP', 'ADMIN'])

/**
 * Página de Férias. A aba "Visão geral" lista as solicitações — o COLABORADOR
 * só vê a aba Pessoal. O DP/ADMIN têm também a aba "Feriados" (mapa que limita
 * o calendário). O backend é a fonte da verdade das permissões.
 */
export function FeriasList() {
  const { usuario } = useAuth()
  const papel = usuario?.papelCodigo
  const ehColaborador = papel === 'COLABORADOR'
  const podeGerirFeriados = Boolean(papel && PAPEIS_FERIADOS.has(papel))
  const {
    solicitacoes,
    aprovar,
    confirmar,
    sugerirAjuste,
    aceitarAjuste,
    rejeitar,
    cancelar,
    registrarManual,
    recarregar,
  } = useFerias(!ehColaborador)
  const [tab, setTab] = useState('visao-geral')

  // Recarrega a Visão geral ao voltar pra ela — reflete cancelamentos/decisões
  // feitos na aba Pessoal (ou por outra pessoa) sem ficar com dado velho.
  function handleTabChange(nova: string) {
    setTab(nova)
    if (nova === 'visao-geral') recarregar()
  }

  if (ehColaborador) {
    return (
      <AppLayout title="Férias" description="Home / Gestão de Pessoas / Férias">
        <FeriasPessoal />
      </AppLayout>
    )
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange} className="flex flex-col w-full">
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
            {podeGerirFeriados && (
              <TabsTrigger value="feriados" className="px-5">
                <CalendarDays className="mr-2 h-4 w-4" />
                Feriados
              </TabsTrigger>
            )}
          </TabsList>
        }
      >
        <TabsContent value="visao-geral">
          <FeriasOverview
            solicitacoes={solicitacoes}
            onAprovar={aprovar}
            onConfirmar={confirmar}
            onSugerirAjuste={sugerirAjuste}
            onAceitarAjuste={aceitarAjuste}
            onRejeitar={rejeitar}
            onCancelar={cancelar}
            onRegistrarManual={registrarManual}
          />
        </TabsContent>

        <TabsContent value="pessoal">
          <FeriasPessoal />
        </TabsContent>

        {podeGerirFeriados && (
          <TabsContent value="feriados">
            <FeriadosAdmin />
          </TabsContent>
        )}
      </AppLayout>
    </Tabs>
  )
}
