import { getToken } from '@/lib/auth'
import type {
  FeriasResumo,
  MinhaSolicitacao,
  SolicitacaoFerias,
} from '../types'

/**
 * Service de Férias — chamadas HTTP à API (via proxy /api). Sem estado/UI.
 */

const API_URL = '/api'

/** Header Authorization quando há token salvo. */
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

/** Lê {message} do corpo em erro e lança. */
async function lancarErro(response: Response, fallback: string): Promise<never> {
  const corpo = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  throw new Error(corpo?.message ?? fallback)
}

/**
 * A API devolve o avatar como caminho relativo ("/usuarios/:id/avatar"); aqui
 * prefixamos com "/api" (proxy). URLs http/data ficam como estão.
 */
function resolverAvatar(url: string): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  return `${API_URL}${url}`
}

/** Entrada para criar uma solicitação. */
export interface CriarSolicitacaoInput {
  tipo: 'FERIAS' | 'FOLGA'
  dataInicio: string // YYYY-MM-DD
  dataFim: string
  abono: boolean
  observacoes: string | null
}

export const feriasService = {
  /** Todas as solicitações (Visão geral). */
  async getSolicitacoes(): Promise<SolicitacaoFerias[]> {
    const response = await fetch(`${API_URL}/ferias`, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar solicitações')
    const json = (await response.json()) as ApiListResponse<SolicitacaoFerias>
    return json.data.map((s) => ({ ...s, avatarUrl: resolverAvatar(s.avatarUrl) }))
  },

  /** Histórico do próprio colaborador (aba Pessoal). */
  async getMinhas(): Promise<MinhaSolicitacao[]> {
    const response = await fetch(`${API_URL}/ferias/minhas`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar seu histórico')
    const json = (await response.json()) as ApiListResponse<MinhaSolicitacao>
    return json.data
  },

  /** Resumo do saldo (cards do topo). */
  async getResumo(): Promise<FeriasResumo> {
    const response = await fetch(`${API_URL}/ferias/resumo`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar o resumo')
    const json = (await response.json()) as ApiResponse<FeriasResumo>
    return json.data
  },

  /** Cria uma solicitação de férias/folga. */
  async criar(input: CriarSolicitacaoInput): Promise<SolicitacaoFerias> {
    const response = await fetch(`${API_URL}/ferias`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao criar a solicitação')
    const json = (await response.json()) as ApiResponse<SolicitacaoFerias>
    return { ...json.data, avatarUrl: resolverAvatar(json.data.avatarUrl) }
  },

  /** Aprova uma solicitação. */
  async aprovar(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/aprovar`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao aprovar')
  },

  /** Recusa uma solicitação com justificativa. */
  async recusar(id: string, motivo: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/recusar`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ motivo }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao recusar')
  },
}
