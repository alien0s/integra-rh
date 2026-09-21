import { getToken } from '@/lib/auth'
import type {
  ExcecaoFeriasUsuario,
  FeriasResumo,
  MinhaSolicitacao,
  SolicitacaoFerias,
  VisaoGeralFerias,
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
  observacoes: string | null
  /** Dias vendidos (abono), 0-10 — exige a exceção pode_vender_ferias. */
  diasVendidos?: number
}

/** Entrada para atualizar as exceções de um colaborador (aba "Exceções"). */
export interface AtualizarExcecaoFeriasInput {
  podeFracionarFerias: boolean
  podeVenderFerias: boolean
}

/** Entrada para o RH/Admin registrar manualmente férias/folga já ocorridas. */
export interface RegistrarFeriasManualInput {
  usuarioId: string
  tipo: 'FERIAS' | 'FOLGA'
  dataInicio: string // YYYY-MM-DD
  dataFim: string
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

  /** 1ª etapa — gestor do setor aprova (PENDENTE → AGUARDANDO_DP). */
  async aprovar(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/aprovar`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao aprovar')
  },

  /** 2ª etapa — DP confirma (AGUARDANDO_DP → APROVADA). */
  async confirmar(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/confirmar`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao confirmar')
  },

  /**
   * 2ª etapa (alternativa à confirmação) — DP sugere um novo início pro
   * período (até 5 dias de deslocamento), devolvendo pro colaborador aceitar.
   */
  async sugerirAjuste(
    id: string,
    input: { dataInicioSugerida: string; motivo: string },
  ): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/sugerir-ajuste`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao sugerir o ajuste')
  },

  /** Colaborador aceita o ajuste de data sugerido pelo DP. */
  async aceitarAjuste(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/aceitar-ajuste`, {
      method: 'PATCH',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao aceitar o ajuste')
  },

  /** Recusa uma solicitação com justificativa (obrigatória). */
  async recusar(id: string, motivo: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/recusar`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ motivo }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao recusar')
  },

  /** Cancela uma solicitação (colaborador dono, ou DP/ADMIN). */
  async cancelar(id: string, motivo?: string | null): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}/cancelar`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ motivo: motivo ?? null }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao cancelar')
  },

  /** Exclui uma solicitação já cancelada (histórico da aba Pessoal). */
  async excluir(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/ferias/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao excluir')
  },

  /** Férias da equipe do gestor (dialog "Calendário da equipe"). */
  async getEquipe(): Promise<SolicitacaoFerias[]> {
    const response = await fetch(`${API_URL}/ferias/equipe`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar a equipe')
    const json = (await response.json()) as ApiListResponse<SolicitacaoFerias>
    return json.data.map((s) => ({ ...s, avatarUrl: resolverAvatar(s.avatarUrl) }))
  },

  /** Visão geral (DP/RH): quem entra e quem precisa tirar; filtro por mês. */
  async getGeral(mes?: string): Promise<VisaoGeralFerias> {
    const url = mes
      ? `${API_URL}/ferias/geral?mes=${encodeURIComponent(mes)}`
      : `${API_URL}/ferias/geral`
    const response = await fetch(url, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar a visão geral')
    const json = (await response.json()) as ApiResponse<VisaoGeralFerias>
    const d = json.data
    return {
      vaoEntrar: d.vaoEntrar.map((s) => ({ ...s, avatarUrl: resolverAvatar(s.avatarUrl) })),
      precisamTirar: d.precisamTirar.map((c) => ({
        ...c,
        avatarUrl: resolverAvatar(c.avatarUrl),
      })),
    }
  },

  /**
   * RH/Admin registra manualmente férias/folga já ocorridas fora do sistema
   * (histórico/retroativo). Já entra aprovado — não precisa aprovar depois.
   */
  async registrarManual(input: RegistrarFeriasManualInput): Promise<SolicitacaoFerias> {
    const response = await fetch(`${API_URL}/ferias/registrar-manual`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao registrar manualmente')
    const json = (await response.json()) as ApiResponse<SolicitacaoFerias>
    return { ...json.data, avatarUrl: resolverAvatar(json.data.avatarUrl) }
  },

  /** Aba "Exceções" (DP): lista os colaboradores e o estado das duas exceções. */
  async listarExcecoes(): Promise<ExcecaoFeriasUsuario[]> {
    const response = await fetch(`${API_URL}/ferias/excecoes`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar as exceções')
    const json = (await response.json()) as ApiListResponse<ExcecaoFeriasUsuario>
    return json.data.map((u) => ({ ...u, avatarUrl: resolverAvatar(u.avatarUrl) }))
  },

  /** Liga/desliga as exceções de fracionamento/venda de um colaborador. */
  async atualizarExcecao(
    usuarioId: string,
    input: AtualizarExcecaoFeriasInput,
  ): Promise<ExcecaoFeriasUsuario> {
    const response = await fetch(`${API_URL}/ferias/excecoes/${usuarioId}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao atualizar a exceção')
    const json = (await response.json()) as ApiResponse<ExcecaoFeriasUsuario>
    return { ...json.data, avatarUrl: resolverAvatar(json.data.avatarUrl) }
  },
}
