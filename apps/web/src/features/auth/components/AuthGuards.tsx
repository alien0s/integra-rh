import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AUTH_ENABLED } from '@/lib/auth'
import { useAuth } from '@/features/auth/context'
import { LANCAMENTO_BETA_ATIVO, moduloLiberado, moduloLiberadoNoBeta } from '@/features/auth/lib/modulos'

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
 * Bloqueia o acesso a um módulo (moduloCodigo, ver MODULOS_SIDEBAR em
 * AppSidebar.tsx) nas rotas que envolve — usada em cima de `RequireAuth`. Se
 * digitar a URL direto na barra, cai aqui e é redirecionado — não é só a
 * sidebar que esconde o link. Checa as duas camadas que decidem se o módulo
 * aparece no sidebar (moduloLiberado) E se já saiu do cadeado do lançamento
 * beta (moduloLiberadoNoBeta) — mesmas checagens do sidebar, fonte única em
 * vez de um guard hardcoded por módulo. O bloqueio de verdade continua no
 * backend (exigirPapeis()/bloquearColaborador/exigirAcessoBeta em cada rota
 * da API); isto é só UX (evita a página carregar e falhar pedido por pedido
 * com 403).
 *
 * Redireciona para `/meu-perfil` (não `/home`): é a única rota que o próprio
 * app já garante sempre acessível a todo mundo — redirecionar para `/home`
 * arriscaria um loop de redirect se o módulo "home" também estiver oculto/
 * bloqueado para o papel.
 */
export function RequireModulo({ moduloCodigo }: { moduloCodigo: string }) {
  const { usuario } = useAuth()

  if (!moduloLiberado(usuario, moduloCodigo) || !moduloLiberadoNoBeta(usuario, moduloCodigo)) {
    return <Navigate to="/meu-perfil" replace />
  }

  return <Outlet />
}

/**
 * Lançamento pra algumas pessoas (por enquanto): trava as rotas que envolve
 * pra quem não é ADMIN, redirecionando pra /meu-perfil (única rota sempre
 * liberada, mesmo durante o beta — nunca pode ser envolvida por este guard,
 * senão vira loop de redirect). Hoje só usada em `/configuracoes` — uma rota
 * que não é módulo do sidebar (não tem moduloCodigo nem entra na matriz de
 * "Visibilidade de módulos"), então continua com a regra antiga, só ADMIN,
 * sem liberação antecipada por papel. Os demais módulos usam `RequireModulo`
 * acima, que já cobre o cadeado do beta via `moduloLiberadoNoBeta`.
 */
export function RequireLancamentoBeta() {
  const { usuario } = useAuth()

  if (LANCAMENTO_BETA_ATIVO && usuario?.papelCodigo !== 'ADMIN') {
    return <Navigate to="/meu-perfil" replace />
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
