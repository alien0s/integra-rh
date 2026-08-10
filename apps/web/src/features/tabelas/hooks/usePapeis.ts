import { useEffect, useState } from 'react'

import type { Papel, PapelInput } from '@/features/tabelas/types'
import { tabelasService } from '@/features/tabelas/services'

/**
 * Hook que busca e mantém a lista de papéis (perfis de acesso) e expõe as
 * operações de criar/atualizar/excluir usadas pela tela Tabelas.
 */
export function usePapeis() {
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await tabelasService.getPapeis()
        if (ativo) setPapeis(data)
      } catch {
        if (ativo) setError('Não foi possível carregar os papéis.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  async function criarPapel(input: PapelInput) {
    const criado = await tabelasService.criarPapel(input)
    setPapeis((lista) =>
      [...lista, criado].sort((a, b) => b.nivel - a.nivel || a.nome.localeCompare(b.nome, 'pt-BR')),
    )
  }

  async function atualizarPapel(id: string, input: PapelInput) {
    const atualizado = await tabelasService.atualizarPapel(id, input)
    setPapeis((lista) => lista.map((p) => (p.id === id ? atualizado : p)))
  }

  async function excluirPapel(id: string) {
    await tabelasService.excluirPapel(id)
    setPapeis((lista) => lista.filter((p) => p.id !== id))
  }

  return { papeis, isLoading, error, criarPapel, atualizarPapel, excluirPapel }
}
