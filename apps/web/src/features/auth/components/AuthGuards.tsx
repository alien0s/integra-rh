import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AUTH_ENABLED } from '@/lib/auth'
import { useAuth } from '@/features/auth/context'

/**
 * Protege rotas: sem sessão válida, redireciona para /login guardando a
 * origem (para voltar após o login). Em modo dev (AUTH_ENABLED=false), libera.
 */
export function RequireAuth() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!AUTH_ENABLED) return <Outlet />

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

/**
 * Para rotas públicas (ex.: /login): se já está logado, manda para /home.
 */
export function RedirectSeLogado({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()

  if (AUTH_ENABLED && isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  return children
}
