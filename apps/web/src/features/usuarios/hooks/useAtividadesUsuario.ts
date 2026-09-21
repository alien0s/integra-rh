import { useEffect, useState } from 'react'

import type { AtividadeUsuario } from '@/features/usuarios/types'
import { usuariosService } from '@/features/usuarios/services'

/**
 * Hook que busca as atividades recentes de um usuário (ações que ele
 * realizou no sistema — ver AtividadesRecentesCard).
 */
export function useAtividadesUsuario(id: string | undefined) {
  const [atividades, setAtividades] = useState<AtividadeUsuario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setIsLoading(false)
      return
    }

    let ativo = true

    async function carregar() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await usuariosService.getAtividades(id as string)
        if (ativo) setAtividades(data)
      } catch {
        if (ativo) setError('Não foi possível carregar as atividades.')
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [id])

  return { atividades, isLoading, error }
}
