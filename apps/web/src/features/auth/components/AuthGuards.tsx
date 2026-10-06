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
 * Papéis liberados pro VR (por `codigo`, catálogo `roles`) além de ADMIN:
 * DP (Departamento Pessoal), COORDENADOR DP (Coord. Departamento Pessoal),
 * ASSISTENTE (Tesoureiro Assistente, nível 4) e TESOUREIRO (nível 5). Mesmo
 * conjunto no backend (`PAPEIS_LIBERADOS_VR` em
 * apps/api/src/routes/vr.routes.ts, com o mapeamento código → id de cada
 * papel documentado lá) e no sidebar (`podeVerVr` em AppSidebar.tsx) — sem
 * módulo compartilhado entre os dois deployables, mantenha as três listas
 * em sincronia. Ver também docs/vr.md (seção de permissões).
 */
const PAPEIS_LIBERADOS_VR = new Set(['DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO'])

/**
 * Bloqueia quem não está em PAPEIS_LIBERADOS_VR nas rotas que envolve (ADMIN
 * sempre passa, mesma convenção de exigirPapeis) — usada em cima de
 * `RequireAuth`. A proteção de verdade é no backend (exigirAcessoVr em
 * vr.routes.ts), isto é só UX.
 */
export function RequireVr() {
  const { usuario } = useAuth()
  const liberado =
    usuario?.papelCodigo === 'ADMIN' ||
    (usuario?.papelCodigo !== undefined && PAPEIS_LIBERADOS_VR.has(usuario.papelCodigo))

  if (!liberado) {
    return <Navigate to="/home" replace />
  }

  return <Outlet />
}

/**
 * Lançamento pra algumas pessoas (por enquanto): trava as rotas que envolve
 * pra quem não é ADMIN, redirecionando pra /meu-perfil (única rota sempre
 * liberada, mesmo durante o beta — nunca pode ser envolvida por este guard,
 * senão vira loop de redirect). Espelha o cadeado do AppSidebar.tsx
 * (LANCAMENTO_BETA_ATIVO igual, mesmo nome) — desative os dois juntos
 * quando lançar geral. Não cobre /vr, que já tem seu próprio controle
 * (RequireVr) — mantido fora deste guard em App.tsx.
 *
 * `papeisExtras` libera outros papéis além de ADMIN pra esse grupo de rotas
 * específico — usado em /cursos, que RH já pode acessar pra aprovar/recusar
 * cursos/formações/idiomas fora do beta (ver
 * exigirAdminOuPapeisDuranteBeta no backend, mesma ideia).
 */
const LANCAMENTO_BETA_ATIVO = true

export function RequireLancamentoBeta({ papeisExtras }: { papeisExtras?: Set<string> }) {
  const { usuario } = useAuth()
  const liberado =
    usuario?.papelCodigo === 'ADMIN' ||
    (usuario?.papelCodigo !== undefined && papeisExtras?.has(usuario.papelCodigo))

  if (LANCAMENTO_BETA_ATIVO && !liberado) {
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
