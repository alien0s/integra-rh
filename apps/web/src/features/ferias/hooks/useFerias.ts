import { useEffect, useState } from 'react'

import type { SolicitacaoFerias } from '@/features/ferias/types'
import { feriasService } from '@/features/ferias/services'

/**
 * Hook para buscar e gerenciar as solicitações de férias.
 */
export function useFerias() {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFerias[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      try {
        const data = await feriasService.getSolicitacoes()
        if (ativo) setSolicitacoes(data)
      } catch (error) {
        console.error('Erro ao buscar solicitações de férias', error)
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  /** Aprova a solicitação (placeholder local até a integração com a API). */
  function aprovar(id: string) {
    setSolicitacoes((atual) =>
      atual.map((s) => (s.id === id ? { ...s, status: 'APROVADA' } : s))
    )
  }

  /** Rejeita a solicitação com uma justificativa (placeholder local até a API). */
  function rejeitar(id: string, motivo: string) {
    setSolicitacoes((atual) =>
      atual.map((s) =>
        s.id === id ? { ...s, status: 'REJEITADA', motivoRejeicao: motivo } : s
      )
    )
  }

  return { solicitacoes, isLoading, aprovar, rejeitar }
}
