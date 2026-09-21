import { useCallback, useEffect, useState } from 'react'

import type { AtualizarUsuarioInput, Usuario } from '@/features/usuarios/types'
import { usuariosService } from '@/features/usuarios/services'

/**
 * Hook que busca um único usuário pelo id.
 * Retorna o usuário (ou null se não encontrado), carregamento e erro.
 */
export function useUsuario(id: string | undefined) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const recarregar = useCallback(async () => {
    if (!id) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      setUsuario(await usuariosService.getUsuario(id))
    } catch {
      setError('Não foi possível carregar o usuário.')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    recarregar()
  }, [recarregar])

  /**
   * Faz upload de uma nova foto (Blob já recortado) e atualiza o avatar
   * exibido com a URL retornada pela API.
   */
  async function atualizarAvatar(blob: Blob) {
    if (!id) return
    const { url } = await usuariosService.uploadAvatar(id, blob)
    setUsuario((anterior) => (anterior ? { ...anterior, fotoUrl: url } : anterior))
  }

  /** Atualiza os campos editáveis do usuário e sincroniza o estado local. */
  async function atualizarUsuario(input: AtualizarUsuarioInput) {
    if (!id) return
    const atualizado = await usuariosService.atualizarUsuario(id, input)
    setUsuario(atualizado)
  }

  return { usuario, isLoading, error, atualizarAvatar, atualizarUsuario, recarregar }
}
