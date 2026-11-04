import { useEffect, useState } from 'react'

import type { FluxoAprovador, FluxoAprovadorInput } from '../types'
import { fluxoAprovadoresService } from '../services'

/**
 * Hook da tela "Fluxo de aprovação" (ADMIN, módulo Férias): carrega as
 * exceções cadastradas e expõe criar/atualizar/excluir, atualizando o
 * estado local com a resposta da API.
 */
export function useFluxoAprovadores() {
  const [fluxo, setFluxo] = useState<FluxoAprovador[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fluxoAprovadoresService.listar()
        if (ativo) setFluxo(data)
      } catch {
        if (ativo) setError('Não foi possível carregar o fluxo de aprovação.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  async function criar(input: FluxoAprovadorInput) {
    const criado = await fluxoAprovadoresService.criar(input)
    setFluxo((lista) => [...lista, criado])
  }

  async function atualizar(id: string, input: FluxoAprovadorInput) {
    const atualizado = await fluxoAprovadoresService.atualizar(id, input)
    setFluxo((lista) => lista.map((f) => (f.id === id ? atualizado : f)))
  }

  async function excluir(id: string) {
    await fluxoAprovadoresService.excluir(id)
    setFluxo((lista) => lista.filter((f) => f.id !== id))
  }

  return { fluxo, isLoading, error, criar, atualizar, excluir }
}
