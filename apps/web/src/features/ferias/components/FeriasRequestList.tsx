import type { SolicitacaoFerias } from '@/features/ferias/types'

import { FeriasRequestCard } from './FeriasRequestCard'

interface FeriasRequestListProps {
  solicitacoes: SolicitacaoFerias[]
  onAprovar?: (id: string) => void
  onRejeitar?: (id: string, motivo: string) => void
}

/**
 * Grade de cards de solicitações de férias.
 */
export function FeriasRequestList({
  solicitacoes,
  onAprovar,
  onRejeitar,
}: FeriasRequestListProps) {
  if (solicitacoes.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Nenhuma solicitação encontrada.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {solicitacoes.map((solicitacao) => (
        <FeriasRequestCard
          key={solicitacao.id}
          solicitacao={solicitacao}
          onAprovar={onAprovar}
          onRejeitar={onRejeitar}
        />
      ))}
    </div>
  )
}
