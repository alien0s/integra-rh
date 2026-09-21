import { useCallback, useEffect, useState } from 'react'

import type { ExcecaoFeriasUsuario } from '@/features/ferias/types'
import { feriasService } from '@/features/ferias/services'

/**
 * Hook da aba "Exceções" (DP): lista os colaboradores ativos e expõe a
 * alternância de cada exceção (fracionar/vender), atualizando a linha local
 * com a resposta da API ao concluir.
 */
export function useExcecoesFerias() {
  const [excecoes, setExcecoes] = useState<ExcecaoFeriasUsuario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setExcecoes(await feriasService.listarExcecoes())
    } catch {
      setError('Não foi possível carregar as exceções.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Alterna uma das duas exceções de um colaborador. */
  async function alternar(
    usuarioId: string,
    campo: 'podeFracionarFerias' | 'podeVenderFerias',
    valor: boolean,
  ) {
    const atual = excecoes.find((e) => e.id === usuarioId)
    if (!atual) return

    const atualizado = await feriasService.atualizarExcecao(usuarioId, {
      podeFracionarFerias: atual.podeFracionarFerias,
      podeVenderFerias: atual.podeVenderFerias,
      [campo]: valor,
    })
    setExcecoes((lista) => lista.map((e) => (e.id === usuarioId ? atualizado : e)))
  }

  return { excecoes, isLoading, error, alternar }
}
