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

  /** Cancela uma solicitação própria (enquanto não confirmada) e recarrega. */
  async function cancelar(id: string) {
    await feriasService.cancelar(id)
    await carregar()
  }

  /**
   * Exclui uma solicitação própria do histórico. Só é permitido depois de
   * cancelada — o backend também garante isso (409 se não estiver), aqui
   * espelhado no front pra desabilitar a opção antes mesmo de tentar.
   */
  async function excluir(id: string) {
    await feriasService.excluir(id)
    await carregar()
  }

  /**
   * Aceita o ajuste de data sugerido pelo DP: aplica o novo período e
   * reinicia o fluxo de aprovação (gestor aprova de novo, DP confirma de
   * novo). Não há "recusar o ajuste" — pra isso, cancela a solicitação.
   */
  async function aceitarAjuste(id: string) {
    await feriasService.aceitarAjuste(id)
    await carregar()
  }

  return { resumo, historico, isLoading, solicitar, cancelar, excluir, aceitarAjuste }
}
