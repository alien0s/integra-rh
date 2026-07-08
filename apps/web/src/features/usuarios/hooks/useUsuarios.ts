import { useEffect, useState } from 'react'

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

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await usuariosService.getUsuarios()
        if (ativo) setUsuarios(data)
      } catch {
        if (ativo) setError('Não foi possível carregar os usuários.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  /**
   * Atualiza um usuário e sincroniza o item correspondente na lista local.
   */
  async function atualizarUsuario(id: string, input: AtualizarUsuarioInput) {
    const atualizado = await usuariosService.atualizarUsuario(id, input)
    setUsuarios((lista) =>
      lista.map((u) => (u.id === id ? atualizado : u)),
    )
  }

  return { usuarios, isLoading, error, atualizarUsuario }
}
