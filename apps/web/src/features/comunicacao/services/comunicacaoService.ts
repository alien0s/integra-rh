import { getToken } from '@/lib/auth'
import type { Comunicado, CriarComunicadoInput } from '../types'

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

async function lancarErro(response: Response, fallback: string): Promise<never> {
  const corpo = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  throw new Error(corpo?.message ?? fallback)
}

interface ApiListResponse<T> {
  data: T[]
  total: number
}

export const comunicacaoService = {
  async listarAtivos(): Promise<Comunicado[]> {
    const response = await fetch(`${API_URL}/comunicados/ativos`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar os comunicados ativos')
    const json = (await response.json()) as ApiListResponse<Comunicado>
    return json.data
  },

  async listarAgendados(): Promise<Comunicado[]> {
    const response = await fetch(`${API_URL}/comunicados/agendados`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar os comunicados agendados')
    const json = (await response.json()) as ApiListResponse<Comunicado>
    return json.data
  },


  async remover(comunicadoId: number): Promise<Comunicado> {
    const response = await fetch(`${API_URL}/comunicados/${comunicadoId}/remover`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao remover o comunicado')
    const json = (await response.json()) as ApiResponse<Comunicado>
    return json.data
  },

  /** Busca o anexo do comunicado e devolve uma object URL pra usar em <img> ou abrir. */
  async buscarAnexoUrl(comunicadoId: number): Promise<string> {
    const response = await fetch(`${API_URL}/comunicados/${comunicadoId}/anexo`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar o anexo')
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  },
  async listarPendentes(): Promise<Comunicado[]> {
    const response = await fetch(`${API_URL}/comunicados/pendentes`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar os comunicados pendentes')
    const json = (await response.json()) as ApiListResponse<Comunicado>
    return json.data
  },

  async aprovar(comunicadoId: number): Promise<Comunicado> {
    const response = await fetch(`${API_URL}/comunicados/${comunicadoId}/aprovar`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao aprovar o comunicado')
    const json = (await response.json()) as ApiResponse<Comunicado>
    return json.data
  },

  async rejeitar(comunicadoId: number, motivoRejeicao: string): Promise<Comunicado> {
    const response = await fetch(`${API_URL}/comunicados/${comunicadoId}/rejeitar`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ motivoRejeicao }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao rejeitar o comunicado')
    const json = (await response.json()) as ApiResponse<Comunicado>
    return json.data
  },
  async criar(input: CriarComunicadoInput): Promise<Comunicado> {
    const response = await fetch(`${API_URL}/comunicados`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao criar o comunicado')
    const json = (await response.json()) as ApiResponse<Comunicado>
    return json.data
  },

  /** Envia (ou troca) o anexo de um comunicado já criado. */
  async enviarAnexo(comunicadoId: number, arquivo: File): Promise<Comunicado> {
    const formData = new FormData()
    formData.append('anexo', arquivo)
    const response = await fetch(`${API_URL}/comunicados/${comunicadoId}/anexo`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    })
    if (!response.ok) return lancarErro(response, 'Falha ao enviar o anexo')
    const json = (await response.json()) as ApiResponse<Comunicado>
    return json.data
  },
}