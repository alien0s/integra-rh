import { useEffect, useState } from 'react'

import type { Funcao, FuncaoInput } from '@/features/tabelas/types'
import { tabelasService } from '@/features/tabelas/services'

/**
 * Hook que busca e mantém a lista de funções (cargos) e expõe as operações
 * de criar/atualizar/excluir usadas pela tela Tabelas.
 */
export function useFuncoes() {
  const [funcoes, setFuncoes] = useState<Funcao[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await tabelasService.getFuncoes()
        if (ativo) setFuncoes(data)
      } catch {
        if (ativo) setError('Não foi possível carregar as funções.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  async function criarFuncao(input: FuncaoInput) {
    const criada = await tabelasService.criarFuncao(input)
    setFuncoes((lista) =>
      [...lista, criada].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    )
  }

  async function atualizarFuncao(id: string, input: FuncaoInput) {
    const atualizada = await tabelasService.atualizarFuncao(id, input)
    setFuncoes((lista) => lista.map((f) => (f.id === id ? atualizada : f)))
  }

  async function excluirFuncao(id: string) {
    await tabelasService.excluirFuncao(id)
    setFuncoes((lista) => lista.filter((f) => f.id !== id))
  }

  return { funcoes, isLoading, error, criarFuncao, atualizarFuncao, excluirFuncao }
}
