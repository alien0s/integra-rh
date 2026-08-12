import { useCallback, useEffect, useState } from 'react'

import type { SolicitacaoFerias } from '@/features/ferias/types'
import { feriasService } from '@/features/ferias/services'

/**
 * Hook da Visão geral: lista as solicitações (API) e aprova/recusa,
 * atualizando o item na lista local após a resposta do backend.
 */
export function useFerias() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFerias[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    try {
      setSolicitacoes(await feriasService.getSolicitacoes())
    } catch (error) {
      console.error('Erro ao buscar solicitações de férias', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Aprova e reflete o novo status no item. */
  async function aprovar(id: string) {
    await feriasService.aprovar(id)
    setSolicitacoes((atual) =>
      atual.map((s) => (s.id === id ? { ...s, status: 'APROVADA' } : s)),
    )
  }

  /** Recusa com justificativa e reflete no item. */
  async function rejeitar(id: string, motivo: string) {
    await feriasService.recusar(id, motivo)
    setSolicitacoes((atual) =>
      atual.map((s) =>
        s.id === id ? { ...s, status: 'REJEITADA', motivoRejeicao: motivo } : s,
      ),
    )
  }

  return { solicitacoes, isLoading, aprovar, rejeitar, recarregar: carregar }
}
