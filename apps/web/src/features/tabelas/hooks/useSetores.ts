import { useEffect, useState } from 'react'

import type { Setor, SetorInput } from '@/features/tabelas/types'
import { tabelasService } from '@/features/tabelas/services'

/**
 * Hook que busca e mantém a lista de setores e expõe as operações de
 * criar/atualizar/excluir usadas pela tela Tabelas.
 */
export function useSetores() {
  const [setores, setSetores] = useState<Setor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await tabelasService.getSetores()
        if (ativo) setSetores(data)
      } catch {
        if (ativo) setError('Não foi possível carregar os setores.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  async function criarSetor(input: SetorInput) {
    const criado = await tabelasService.criarSetor(input)
    setSetores((lista) =>
      [...lista, criado].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    )
  }

  async function atualizarSetor(id: string, input: SetorInput) {
    const atualizado = await tabelasService.atualizarSetor(id, input)
    setSetores((lista) => lista.map((s) => (s.id === id ? atualizado : s)))
  }

  async function excluirSetor(id: string) {
    await tabelasService.excluirSetor(id)
    setSetores((lista) => lista.filter((s) => s.id !== id))
  }

  return {
    setores,
    isLoading,
    error,
    criarSetor,
    atualizarSetor,
    excluirSetor,
  }
}
