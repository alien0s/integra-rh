import { useEffect, useState } from 'react'

import type { Entidade, EntidadeInput } from '@/features/tabelas/types'
import { tabelasService } from '@/features/tabelas/services'

/**
 * Hook que busca e mantém a lista de entidades (empresas/organizações) e
 * expõe as operações de criar/atualizar/excluir usadas pela tela Tabelas.
 *
 * `enabled=false` pula a busca — usado quando o editor não tem o dropdown
 * de entidade na tela (ex.: COLABORADOR editando o próprio perfil, restrito
 * a cpf/telefone) e a API bloquearia essa lista pra esse papel mesmo.
 */
export function useEntidades(enabled = true) {
  const [entidades, setEntidades] = useState<Entidade[]>([])
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await tabelasService.getEntidades()
        if (ativo) setEntidades(data)
      } catch {
        if (ativo) setError('Não foi possível carregar as entidades.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [enabled])

  async function criarEntidade(input: EntidadeInput) {
    const criada = await tabelasService.criarEntidade(input)
    setEntidades((lista) =>
      [...lista, criada].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    )
  }

  async function atualizarEntidade(id: string, input: EntidadeInput) {
    const atualizada = await tabelasService.atualizarEntidade(id, input)
    setEntidades((lista) => lista.map((e) => (e.id === id ? atualizada : e)))
  }

  async function excluirEntidade(id: string) {
    await tabelasService.excluirEntidade(id)
    setEntidades((lista) => lista.filter((e) => e.id !== id))
  }

  return { entidades, isLoading, error, criarEntidade, atualizarEntidade, excluirEntidade }
}
