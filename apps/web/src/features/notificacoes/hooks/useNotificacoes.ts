import { useCallback, useEffect, useMemo, useState } from 'react'

import type { Notificacao } from '@/features/notificacoes/types'
import { notificacoesService } from '@/features/notificacoes/services'
import { feriasService } from '@/features/ferias/services'

/**
 * Hook das notificações do usuário logado (API): lista, contagem de não-lidas,
 * marcar todas como lidas e responder às acionáveis (Aprovar/Recusar) — que
 * agem no recurso de origem (ex.: a solicitação de férias) e recarregam.
 */
export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    try {
      setNotificacoes(await notificacoesService.getNotificacoes())
    } catch (error) {
      console.error('Erro ao carregar notificações', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const naoLidas = useMemo(
    () => notificacoes.filter((n) => !n.lida).length,
    [notificacoes],
  )

  /** Marca todas como lidas (API + estado local). */
  async function marcarTodasComoLidas() {
    await notificacoesService.marcarTodasLidas()
    setNotificacoes((anteriores) =>
      anteriores.map((n) => (n.lida ? n : { ...n, lida: true })),
    )
  }

  /**
   * Aprova/recusa o recurso de origem da notificação (hoje: férias) e recarrega.
   * A recusa envia um motivo genérico — a justificativa detalhada é feita na
   * tela de Férias.
   */
  async function agirNaReferencia(id: string, decisao: 'aprovar' | 'recusar') {
    const alvo = notificacoes.find((n) => n.id === id)
    if (!alvo?.referenciaId) return

    if (alvo.referenciaTabela === 'ferias_solicitacoes') {
      if (decisao === 'aprovar') {
        await feriasService.aprovar(alvo.referenciaId)
      } else {
        await feriasService.recusar(alvo.referenciaId, 'Recusado')
      }
    }
    await carregar()
  }

  const aprovar = (id: string) => agirNaReferencia(id, 'aprovar')
  const recusar = (id: string) => agirNaReferencia(id, 'recusar')

  return {
    notificacoes,
    isLoading,
    naoLidas,
    marcarTodasComoLidas,
    aprovar,
    recusar,
  }
}
