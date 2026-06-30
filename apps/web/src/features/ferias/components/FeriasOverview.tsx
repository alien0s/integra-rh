import { useMemo, useState } from 'react'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { SolicitacaoFerias } from '@/features/ferias/types'
import { FeriasRequestList } from './FeriasRequestList'

type FiltroStatus = 'TODOS' | 'PENDENTE' | 'APROVADA'

interface FeriasOverviewProps {
  solicitacoes: SolicitacaoFerias[]
  onAprovar?: (id: string) => void
  onRejeitar?: (id: string, motivo: string) => void
}

/**
 * Seção "Requisições" da Visão geral de Férias: título, filtro por status
 * (Pendente/Aprovado) e a grade de cards filtrada.
 */
export function FeriasOverview({
  solicitacoes,
  onAprovar,
  onRejeitar,
}: FeriasOverviewProps) {
  const [filtro, setFiltro] = useState<FiltroStatus>('TODOS')

  const filtradas = useMemo(
    () =>
      filtro === 'TODOS'
        ? solicitacoes
        : solicitacoes.filter((s) => s.status === filtro),
    [solicitacoes, filtro]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Requisições</h2>
        <Tabs
          value={filtro}
          onValueChange={(value) => setFiltro(value as FiltroStatus)}
        >
          <TabsList className="h-9">
            <TabsTrigger value="TODOS" className="px-5">
              Todos
            </TabsTrigger>
            <TabsTrigger value="PENDENTE" className="px-5">
              Pendente
            </TabsTrigger>
            <TabsTrigger value="APROVADA" className="px-5">
              Aprovado
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <FeriasRequestList
        solicitacoes={filtradas}
        onAprovar={onAprovar}
        onRejeitar={onRejeitar}
      />
    </div>
  )
}
