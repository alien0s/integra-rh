import { useCallback, useEffect, useState } from 'react'

import type { FeriasResumo, MinhaSolicitacao } from '@/features/ferias/types'
import {
  feriasService,
  type CriarSolicitacaoInput,
} from '@/features/ferias/services'

/**
 * Hook da aba "Pessoal": resumo do saldo + histórico do próprio colaborador,
 * e a ação de solicitar (que recarrega os dois ao concluir).
 */
export function useFeriasPessoal() {
  const [resumo, setResumo] = useState<FeriasResumo | null>(null)
  const [historico, setHistorico] = useState<MinhaSolicitacao[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    try {
      const [r, h] = await Promise.all([
        feriasService.getResumo(),
        feriasService.getMinhas(),
      ])
      setResumo(r)
      setHistorico(h)
    } catch (error) {
      console.error('Erro ao carregar dados de férias (pessoal)', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Cria uma solicitação e recarrega resumo + histórico. */
  async function solicitar(input: CriarSolicitacaoInput) {
    await feriasService.criar(input)
    await carregar()
  }

  return { resumo, historico, isLoading, solicitar }
}
