import type { SolicitacaoFerias } from '@/features/ferias/types'

import { FeriasRequestCard } from './FeriasRequestCard'

interface FeriasRequestListProps {
  solicitacoes: SolicitacaoFerias[]
  papel?: string
  usuarioLogadoId?: string
  onAprovar?: (id: string) => void
  onConfirmar?: (id: string) => void
  onSugerirAjuste?: (id: string, dataInicioSugerida: string, motivo: string) => void
  onAceitarAjuste?: (id: string) => Promise<unknown> | void
  onRejeitar?: (id: string, motivo: string) => void
  onCancelar?: (id: string, motivo?: string | null) => void
}

/**
 * Grade de cards de solicitações de férias.
 */
export function FeriasRequestList({
  solicitacoes,
  papel,
  usuarioLogadoId,
  onAprovar,
  onConfirmar,
  onSugerirAjuste,
  onAceitarAjuste,
  onRejeitar,
  onCancelar,
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
          papel={papel}
          usuarioLogadoId={usuarioLogadoId}
          onAprovar={onAprovar}
          onConfirmar={onConfirmar}
          onSugerirAjuste={onSugerirAjuste}
          onAceitarAjuste={onAceitarAjuste}
          onRejeitar={onRejeitar}
          onCancelar={onCancelar}
        />
      ))}
    </div>
  )
}
