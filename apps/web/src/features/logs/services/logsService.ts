import { getToken } from '@/lib/auth'

import type { LogErro } from '../types'

/**
 * Service de Logs — chamadas HTTP à API (via proxy /api). Sem estado/UI.
 */

const API_URL = '/api'

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', ...authHeaders() }
}

interface ApiListResponse<T> {
  data: T[]
  total: number
}

async function lancarErro(response: Response, fallback: string): Promise<never> {
  const corpo = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  throw new Error(corpo?.message ?? fallback)
}

export interface ErroClienteInput {
  modulo: string
  rota: string
  codigo?: string
  mensagem: string
  stack?: string | null
}

export const logsService = {
  /** Últimos logs de erros (backend + front-end), mais recentes primeiro. */
  async listar(limit = 100): Promise<LogErro[]> {
    const response = await fetch(`${API_URL}/logs?limit=${limit}`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar os logs')
    const json = (await response.json()) as ApiListResponse<LogErro>
    return json.data
  },

  /**
   * Reporta um erro que aconteceu só no navegador (nunca virou uma
   * requisição que o backend pudesse ver sozinho — ex.: falha ao compactar
   * um PDF antes do upload). Nunca lança — logar o erro não pode virar um
   * segundo erro pro usuário ver.
   */
  async reportarErro(input: ErroClienteInput): Promise<void> {
    try {
      await fetch(`${API_URL}/logs/cliente`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(input),
      })
    } catch (error) {
      console.error('Falha ao reportar erro de front-end', error)
    }
  },
}
