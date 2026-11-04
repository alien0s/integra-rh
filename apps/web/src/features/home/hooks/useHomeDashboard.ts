import { useCallback, useEffect, useState } from 'react'

import { assinarNotificacoes } from '@/features/notificacoes/lib/notificacaoStream'
import { homeService } from '../services'
import type { DashboardData } from '../types'

/**
 * Hook do dashboard (Home) — busca os dados (comunicados, férias e
 * aniversariantes reais, ver services/homeService.ts). Expõe `recarregar`
 * pra atualizar depois de uma ação (ex.: criar um comunicado).
 *
 * O card de férias se atualiza em TEMPO REAL via a mesma conexão SSE do sino
 * de notificações (ver notificacaoStream.ts) — toda aprovação/confirmação/
 * recusa/cancelamento de férias já emite uma notificação pro próprio
 * colaborador (ver ferias.routes.ts), então não precisa de um canal próprio
 * nem de polling: só reage ao mesmo gatilho que já existe. Ao chegar,
 * busca SÓ o status de férias (não o dashboard inteiro) — comunicados e
 * aniversariantes não mudam por causa de uma ação de férias, então refazer
 * as 3 consultas de novo seria bater no banco à toa.
 */
export function useHomeDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    try {
      setData(await homeService.getDashboardData())
    } catch (error) {
      console.error('Erro ao buscar dados do dashboard', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const atualizarFerias = useCallback(async () => {
    try {
      const ferias = await homeService.getFeriasStatus()
      setData((atual) => (atual ? { ...atual, ferias } : atual))
    } catch (error) {
      console.error('Erro ao atualizar o status de férias', error)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  useEffect(() => {
    return assinarNotificacoes(() => atualizarFerias())
  }, [atualizarFerias])

  return { data, isLoading, recarregar: carregar }
}