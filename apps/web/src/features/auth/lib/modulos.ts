import type { AuthUsuario } from '@/features/auth/lib/token'

/**
 * Decide se `usuario` vê/acessa um módulo (moduloCodigo, ver MODULOS_SIDEBAR
 * em AppSidebar.tsx) — consultado tanto pelo sidebar (esconder o item) quanto
 * pelo guard de rota (RequireModulo, bloquear acesso direto por URL), fonte
 * única em vez das listas duplicadas que existiam antes (AppSidebar.tsx +
 * AuthGuards.tsx). `modulosRestritos` vem do JWT, calculado no login a partir
 * de modulos_visibilidade (ver calcularModulosRestritos em auth.routes.ts).
 *
 * ADMIN e modo dev (papelCodigo undefined) sempre liberados — mesma
 * convenção do backend (exigirPapeis() sempre libera ADMIN).
 */
export function moduloLiberado(usuario: AuthUsuario | null, moduloCodigo: string): boolean {
  if (!usuario || usuario.papelCodigo === undefined || usuario.papelCodigo === 'ADMIN') {
    return true
  }
  return !(usuario.modulosRestritos?.includes(moduloCodigo) ?? false)
}

/**
 * Lançamento pra algumas pessoas (por enquanto): com a flag ligada, todo
 * módulo aparece com cadeado (não navega) pra quem não foi liberado
 * antecipadamente — ver `moduloLiberadoNoBeta` abaixo. Mesma flag no backend
 * (apps/api/src/plugins/auth.ts, `LANCAMENTO_BETA_ATIVO`) — não dá pra
 * compartilhar entre os dois deployables, mantenha as duas em sincronia;
 * desative as duas juntas quando lançar geral.
 */
export const LANCAMENTO_BETA_ATIVO = true

/**
 * Decide se `usuario` usa `moduloCodigo` SEM cadeado durante o lançamento
 * beta — um único toggle por (módulo, papel): ligado (`liberadoAntecipado`
 * em `modulosBetaLiberados`, vindo do JWT) = sem cadeado; desligado (default)
 * = cadeado, "em desenvolvimento, abre em breve pra esse papel" (ver
 * calcularModulosBetaLiberados em auth.routes.ts, configurável pelo ADMIN na
 * tela Tabelas). Só importa pra quem já vê o módulo (`moduloLiberado`) — um
 * módulo oculto nem chega a ser filtrado por aqui.
 *
 * Com o lançamento beta desligado (`LANCAMENTO_BETA_ATIVO = false`), ou pra
 * ADMIN/modo dev, sempre libera.
 */
export function moduloLiberadoNoBeta(usuario: AuthUsuario | null, moduloCodigo: string): boolean {
  if (!LANCAMENTO_BETA_ATIVO) return true
  if (!usuario || usuario.papelCodigo === undefined || usuario.papelCodigo === 'ADMIN') {
    return true
  }
  return usuario.modulosBetaLiberados?.includes(moduloCodigo) ?? false
}
