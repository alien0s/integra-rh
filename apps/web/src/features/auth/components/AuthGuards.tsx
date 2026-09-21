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
 * Bloqueia COLABORADOR nas rotas que envolve — usada em cima de `RequireAuth`
 * (que já garante sessão válida). Se digitar a URL direto na barra, cai aqui
 * e é redirecionado — não é só a sidebar que esconde o link. O bloqueio de
 * verdade é no backend (ver bloquearColaborador em apps/api); isto é só UX
 * (evita a página carregar e falhar pedido por pedido com 403).
 */
export function RequireNaoColaborador() {
  const { usuario } = useAuth()

  if (usuario?.papelCodigo === 'COLABORADOR') {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}

/**
 * Bloqueia quem não é ADMIN (nível 7) nas rotas que envolve — usada em cima
 * de `RequireAuth`. Mesma lógica de `RequireNaoColaborador`: a proteção de
 * verdade é no backend (exigirPapeis() sem argumentos = só ADMIN), isto é só
 * UX (evita a página carregar e falhar pedido por pedido com 403).
 */
export function RequireAdmin() {
  const { usuario } = useAuth()

  if (usuario?.papelCodigo !== 'ADMIN') {
    return <Navigate to="/home" replace />
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
