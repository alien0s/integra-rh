import { useCallback, useEffect, useState } from 'react'

import type { AtualizarUsuarioInput, Usuario } from '@/features/usuarios/types'
import { usuariosService } from '@/features/usuarios/services'

/**
 * Hook que busca a lista de usuários na API.
 * Retorna os dados, o estado de carregamento e um eventual erro.
 */
export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await usuariosService.getUsuarios()
      setUsuarios(data)
    } catch {
      setError('Não foi possível carregar os usuários.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /**
   * Atualiza um usuário e sincroniza o item correspondente na lista local.
   */
  async function atualizarUsuario(id: string, input: AtualizarUsuarioInput) {
    const atualizado = await usuariosService.atualizarUsuario(id, input)
    setUsuarios((lista) =>
      lista.map((u) => (u.id === id ? atualizado : u)),
    )
  }

  /** Exclui um usuário e o remove da lista local. */
  async function excluirUsuario(id: string) {
    await usuariosService.excluirUsuario(id)
    setUsuarios((lista) => lista.filter((u) => u.id !== id))
  }

  return {
    usuarios,
    isLoading,
    error,
    atualizarUsuario,
    excluirUsuario,
    recarregar: carregar,
  }
}
