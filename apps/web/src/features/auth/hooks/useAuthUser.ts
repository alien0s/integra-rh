import { useAuth } from '@/features/auth/context'
import type { AuthUsuario } from '@/features/auth/lib/token'

export type { AuthUsuario }

/**
 * Retorna o usuário logado (do JWT via contexto de auth) ou null.
 * Fino wrapper sobre useAuth() para os consumidores que só querem o usuário.
 */
export function useAuthUser(): AuthUsuario | null {
  return useAuth().usuario
}
