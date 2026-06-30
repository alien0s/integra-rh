/**
 * Flag global de autenticação.
 *
 * Controlada por VITE_AUTH_ENABLED no .env da raiz:
 * - "false" → auth desativada (modo dev): a app abre direto nas features.
 * - qualquer outro valor (ou ausente) → auth ativada.
 *
 * Reative quando as credenciais da Microsoft estiverem prontas.
 */
export const AUTH_ENABLED = import.meta.env.VITE_AUTH_ENABLED !== "false"

/** Rota inicial: features quando auth off, login quando auth on. */
export const LANDING_ROUTE = AUTH_ENABLED ? "/login" : "/home"
