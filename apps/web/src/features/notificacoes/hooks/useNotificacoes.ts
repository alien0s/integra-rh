import { useEffect, useMemo, useState } from 'react'

import type { Notificacao } from '@/features/notificacoes/types'
import { notificacoesService } from '@/features/notificacoes/services'

/**
 * Hook que carrega as notificações do usuário e expõe a contagem de não lidas
 * e a ação de marcar todas como lidas.
 */
export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      try {
        const data = await notificacoesService.getNotificacoes()
        if (ativo) setNotificacoes(data)
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  const naoLidas = useMemo(
    () => notificacoes.filter((n) => !n.lida).length,
    [notificacoes],
  )

  /** Marca todas as notificações como lidas (só no estado local por enquanto). */
  function marcarTodasComoLidas() {
    setNotificacoes((anteriores) =>
      anteriores.map((n) => (n.lida ? n : { ...n, lida: true })),
    )
  }

  /**
   * Resolve uma notificação com cartão de ação (Aprovar/Recusar): remove-a da
   * lista. Por enquanto só no estado local (vira chamada à API depois).
   */
  function responder(id: string) {
    setNotificacoes((anteriores) => anteriores.filter((n) => n.id !== id))
  }

  return {
    notificacoes,
    isLoading,
    naoLidas,
    marcarTodasComoLidas,
    responder,
  }
}
