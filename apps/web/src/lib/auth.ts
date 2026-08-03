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

/** Chave do JWT no localStorage. */
export const TOKEN_KEY = "token"

/** Lê o JWT salvo (ou null). */
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** Salva o JWT. */
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Remove o JWT (logout). */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}
