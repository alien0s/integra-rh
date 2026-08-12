import { getToken } from '@/lib/auth'
import type { Notificacao } from '@/features/notificacoes/types'

/**
 * Service de Notificações — chamadas HTTP à API (via proxy /api).
 */

const API_URL = '/api'

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface ApiListResponse<T> {
  data: T[]
  total: number
  naoLidas: number
}

/** Prefixa o avatar relativo ("/usuarios/:id/avatar") com a base "/api". */
function resolverAvatar(url: string): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  return `${API_URL}${url}`
}

export const notificacoesService = {
  /** Lista as notificações do usuário logado. */
  async getNotificacoes(): Promise<Notificacao[]> {
    const response = await fetch(`${API_URL}/notificacoes`, {
      headers: authHeaders(),
    })
    if (!response.ok) throw new Error('Falha ao buscar notificações')
    const json = (await response.json()) as ApiListResponse<Notificacao>
    return json.data.map((n) => ({ ...n, avatar: resolverAvatar(n.avatar) }))
  },

  /** Marca uma notificação como lida. */
  async marcarLida(id: string): Promise<void> {
    await fetch(`${API_URL}/notificacoes/${id}/lida`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
  },

  /** Marca todas as notificações como lidas. */
  async marcarTodasLidas(): Promise<void> {
    await fetch(`${API_URL}/notificacoes/marcar-todas-lidas`, {
      method: 'POST',
      headers: authHeaders(),
    })
  },
}
