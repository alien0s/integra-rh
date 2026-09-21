import { useCallback, useEffect, useState } from 'react'

import { homeService } from '../services'
import type { DashboardData } from '../types'

/**
 * Hook do dashboard (Home) — busca os dados (comunicados reais; férias e
 * aniversariantes ainda mock, ver services/homeService.ts). Expõe
 * `recarregar` pra atualizar depois de uma ação (ex.: criar um comunicado).
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

  useEffect(() => {
    carregar()
  }, [carregar])

  return { data, isLoading, recarregar: carregar }
}