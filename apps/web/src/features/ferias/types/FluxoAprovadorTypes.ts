/**
 * Exceção configurada ao fluxo padrão de aprovação de férias (tela "Fluxo
 * de aprovação", ADMIN) — espelha FluxoAprovador da API
 * (apps/api/src/lib/fluxoAprovadores.ts). Ainda não conectada à decisão
 * real (ver aviso na tela e na migration 037_fluxo_aprovadores.sql).
 */
export interface FluxoAprovador {
  id: string
  modulo: string
  etapa: string
  grupo: string | null
  userId: string | null
  userNome: string | null
  papelId: string | null
  papelNome: string | null
  setorIds: string[] | null
  setorNomes: string[] | null
}

/** Exatamente um de grupo/userId e exatamente um de papelId/setorIds. */
export interface FluxoAprovadorInput {
  etapa: string
  grupo?: string | null
  userId?: string | null
  papelId?: string | null
  setorIds?: string[] | null
}
