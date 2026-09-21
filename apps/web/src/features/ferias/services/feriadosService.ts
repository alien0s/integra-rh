import { getToken } from '@/lib/auth'
import type { Feriado, FeriadoInput } from '@/features/ferias/types'

/**
 * Service de Feriados — chamadas HTTP à API (/feriados). Leitura para o
 * calendário de férias; escrita/importação só o DP usa (a API valida o papel).
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

export interface ResultadoImportacao {
  inseridos: number
  total: number
}

export const feriadosService = {
  /** Lista feriados (opcionalmente filtrando por ano). */
  async listar(ano?: number): Promise<Feriado[]> {
    const url = ano ? `${API_URL}/feriados?ano=${ano}` : `${API_URL}/feriados`
    const response = await fetch(url, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar feriados')
    const json = (await response.json()) as ApiListResponse<Feriado>
    return json.data
  },

  async criar(input: FeriadoInput): Promise<Feriado> {
    const response = await fetch(`${API_URL}/feriados`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao cadastrar feriado')
    const json = (await response.json()) as ApiResponse<Feriado>
    return json.data
  },

  async atualizar(id: string, input: FeriadoInput): Promise<Feriado> {
    const response = await fetch(`${API_URL}/feriados/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao atualizar feriado')
    const json = (await response.json()) as ApiResponse<Feriado>
    return json.data
  },

  async excluir(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/feriados/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao excluir feriado')
  },

  /** Exclui TODOS os feriados de um ano (zera antes de reimportar, por exemplo). */
  async excluirPorAno(ano: number): Promise<{ removidos: number }> {
    const response = await fetch(`${API_URL}/feriados/ano/${ano}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao excluir feriados do ano')
    const json = (await response.json()) as ApiResponse<{ removidos: number }>
    return json.data
  },

  /** Importa os feriados nacionais de um ano (BrasilAPI, no backend). */
  async importar(ano: number): Promise<ResultadoImportacao> {
    const response = await fetch(`${API_URL}/feriados/importar`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ ano }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao importar feriados')
    const json = (await response.json()) as ApiResponse<ResultadoImportacao>
    return json.data
  },

  /** Importa os feriados municipais/estaduais de um ano do legado (APS, no backend). */
  async importarLegado(ano: number): Promise<ResultadoImportacao> {
    const response = await fetch(`${API_URL}/feriados/importar-legado`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ ano }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao importar feriados do legado')
    const json = (await response.json()) as ApiResponse<ResultadoImportacao>
    return json.data
  },
}
