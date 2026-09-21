import { useCallback, useEffect, useState } from 'react'

import type { Feriado, FeriadoInput } from '@/features/ferias/types'
import { feriadosService } from '@/features/ferias/services'

/**
 * Hook que busca e mantém a lista de feriados de um ANO e expõe as operações
 * de criar/atualizar/excluir/importar (tela do DP). Recarrega ao trocar de ano.
 */
export function useFeriados(ano: number) {
  const [feriados, setFeriados] = useState<Feriado[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setFeriados(await feriadosService.listar(ano))
    } catch {
      setError('Não foi possível carregar os feriados.')
    } finally {
      setIsLoading(false)
    }
  }, [ano])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function criar(input: FeriadoInput) {
    const criado = await feriadosService.criar(input)
    if (criado.ano === ano) {
      setFeriados((lista) =>
        [...lista, criado].sort((a, b) => a.data.localeCompare(b.data)),
      )
    }
  }

  async function atualizar(id: string, input: FeriadoInput) {
    const atualizado = await feriadosService.atualizar(id, input)
    setFeriados((lista) =>
      atualizado.ano === ano
        ? lista.map((f) => (f.id === id ? atualizado : f)).sort((a, b) => a.data.localeCompare(b.data))
        : lista.filter((f) => f.id !== id),
    )
  }

  async function excluir(id: string) {
    await feriadosService.excluir(id)
    setFeriados((lista) => lista.filter((f) => f.id !== id))
  }

  /** Exclui todos os feriados do ano atual. Retorna quantos foram removidos. */
  async function excluirTodosDoAno() {
    const { removidos } = await feriadosService.excluirPorAno(ano)
    setFeriados([])
    return removidos
  }

  /** Importa os nacionais do ano atual e recarrega. Retorna quantos inseridos. */
  async function importar() {
    const resultado = await feriadosService.importar(ano)
    await carregar()
    return resultado
  }

  /** Importa os municipais/estaduais do legado (APS) e recarrega. */
  async function importarLegado() {
    const resultado = await feriadosService.importarLegado(ano)
    await carregar()
    return resultado
  }

  return {
    feriados,
    isLoading,
    error,
    criar,
    atualizar,
    excluir,
    excluirTodosDoAno,
    importar,
    importarLegado,
    recarregar: carregar,
  }
}
