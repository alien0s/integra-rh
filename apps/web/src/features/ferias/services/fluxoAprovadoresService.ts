import { getToken } from '@/lib/auth'
import type { FluxoAprovador, FluxoAprovadorInput } from '../types'

/**
 * Service do "Fluxo de aprovação" (tela ADMIN dentro de Férias) — CRUD puro
 * sobre /ferias/fluxo-aprovadores. Sem estado/UI (ver useFluxoAprovadores).
 */

const API_URL = '/api'

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function jsonHeaders(): HeadersInit {
  return { 'Content-Type': 'application/json', ...authHeaders() }
}

interface ApiResponse<T> {
  data: T
}
interface ApiListResponse<T> {
  data: T[]
  total: number
}

async function lancarErro(response: Response, fallback: string): Promise<never> {
  const corpo = (await response.json().catch(() => null)) as { message?: string } | null
  throw new Error(corpo?.message ?? fallback)
}

export const fluxoAprovadoresService = {
  async listar(): Promise<FluxoAprovador[]> {
    const response = await fetch(`${API_URL}/ferias/fluxo-aprovadores`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar o fluxo de aprovação')
    const json = (await response.json()) as ApiListResponse<FluxoAprovador>
    return json.data
  },

  async criar(input: FluxoAprovadorInput): Promise<FluxoAprovador> {
    const response = await fetch(`${API_URL}/ferias/fluxo-aprovadores`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao criar a exceção')
    const json = (await response.json()) as ApiResponse<FluxoAprovador>
    return json.data
  },

  async atualizar(id: string, input: FluxoAprovadorInput): Promise<FluxoAprovador> {
    const response = await fetch(`${API_URL}/ferias/fluxo-aprovadores/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao atualizar a exceção')
    const json = (await response.json()) as ApiResponse<FluxoAprovador>
    return json.data
  },

  async excluir(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/fluxo-aprovadores/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao excluir a exceção')
  },
}
