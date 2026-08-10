import { useEffect, useState } from 'react'

import type { Departamento, DepartamentoInput } from '@/features/tabelas/types'
import { tabelasService } from '@/features/tabelas/services'

/**
 * Hook que busca e mantém a lista de departamentos e expõe as operações de
 * criar/atualizar/excluir usadas pela tela Tabelas.
 */
export function useDepartamentos() {
  const [departamentos, setDepartamentos] = useState<Departamento[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await tabelasService.getDepartamentos()
        if (ativo) setDepartamentos(data)
      } catch {
        if (ativo) setError('Não foi possível carregar os departamentos.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  async function criarDepartamento(input: DepartamentoInput) {
    const criado = await tabelasService.criarDepartamento(input)
    setDepartamentos((lista) =>
      [...lista, criado].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    )
  }

  async function atualizarDepartamento(id: string, input: DepartamentoInput) {
    const atualizado = await tabelasService.atualizarDepartamento(id, input)
    setDepartamentos((lista) => lista.map((d) => (d.id === id ? atualizado : d)))
  }

  async function excluirDepartamento(id: string) {
    await tabelasService.excluirDepartamento(id)
    setDepartamentos((lista) => lista.filter((d) => d.id !== id))
  }

  return {
    departamentos,
    isLoading,
    error,
    criarDepartamento,
    atualizarDepartamento,
    excluirDepartamento,
  }
}
