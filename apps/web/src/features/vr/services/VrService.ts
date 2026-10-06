import { getToken } from '@/lib/auth'
import type {
  ColaboradorOpcao,
  CriarVrMesInput,
  EditarVrMesInput,
  EntidadeOpcao,
  EscopoVr,
  FechamentoVrResultado,
  FormatoExportacaoVr,
  ItemLancamentoVr,
  LancamentoVr,
  LancamentoVrDetalhado,
  PreVisualizacaoResultado,
  StatusFechamentoEntidade,
  TipoLancamentoVr,
  VrMes,
  VrMesDetalhado,
} from '../types'

/**
 * Service de Vale-Refeição (VR) — chamadas HTTP à API (via proxy /api). Sem estado/UI.
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
  const corpo = (await response.json().catch(() => null)) as {
    message?: string
  } | null
  throw new Error(corpo?.message ?? fallback)
}

const EXTENSAO_POR_FORMATO: Record<FormatoExportacaoVr, string> = {
  pdf: 'pdf',
  csv: 'csv',
  xlsx: 'xlsx',
}

async function baixarComAutenticacao(
  url: string,
  nomeArquivo: string,
  fallback: string,
): Promise<void> {
  const response = await fetch(url, { headers: authHeaders() })
  if (!response.ok) return lancarErro(response, fallback)

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export const vrService = {
  /** Escopo (grupo) da pessoa logada — decide se o cadastro de mês mostra o seletor de grupo. */
  async getEscopo(): Promise<EscopoVr> {
    const response = await fetch(`${API_URL}/vr/escopo`, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar o escopo do VR')
    const json = (await response.json()) as ApiResponse<EscopoVr>
    return json.data
  },

  async getEntidades(): Promise<EntidadeOpcao[]> {
    const response = await fetch(`${API_URL}/vr/entidades`, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar as entidades')
    const json = (await response.json()) as ApiListResponse<EntidadeOpcao>
    return json.data
  },

  async getStatusEntidades(vrMesId: string): Promise<StatusFechamentoEntidade[]> {
    const response = await fetch(`${API_URL}/vr/${vrMesId}/entidades-status`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar o status das entidades')
    const json = (await response.json()) as ApiListResponse<StatusFechamentoEntidade>
    return json.data
  },

  async getColaboradores(entityId?: string): Promise<ColaboradorOpcao[]> {
    const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : ''
    const response = await fetch(`${API_URL}/vr/colaboradores${qs}`, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar os colaboradores')
    const json = (await response.json()) as ApiListResponse<ColaboradorOpcao>
    return json.data
  },

  async getMeses(): Promise<VrMes[]> {
    const response = await fetch(`${API_URL}/vr`, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar os meses de VR')
    const json = (await response.json()) as ApiListResponse<VrMes>
    return json.data
  },

  async criar(input: CriarVrMesInput): Promise<VrMes> {
    const response = await fetch(`${API_URL}/vr`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao cadastrar o mês de VR')
    const json = (await response.json()) as ApiResponse<VrMes>
    return json.data
  },

  async getDetalhe(id: string): Promise<VrMesDetalhado> {
    const response = await fetch(`${API_URL}/vr/${id}`, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar o detalhe do mês')
    const json = (await response.json()) as ApiResponse<VrMesDetalhado>
    return json.data
  },

  async editar(id: string, input: EditarVrMesInput): Promise<VrMes> {
    const response = await fetch(`${API_URL}/vr/${id}`, {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao editar o mês')
    const json = (await response.json()) as ApiResponse<VrMes>
    return json.data
  },

  /** Fecha o VR de 1 entidade dentro de 1 mês (independente das outras). */
  async fecharEntidade(vrMesId: string, entityId: string): Promise<FechamentoVrResultado> {
    const response = await fetch(`${API_URL}/vr/${vrMesId}/entidades/${entityId}/fechar`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao fechar a entidade')
    const json = (await response.json()) as ApiResponse<FechamentoVrResultado>
    return json.data
  },

  /** Baixa o relatório de um mês (pdf, csv ou xlsx), opcionalmente de 1 entidade só. */
  async baixar(vrMes: VrMes, formato: FormatoExportacaoVr, entityId?: string): Promise<void> {
    const nomeArquivo = `vr-${String(vrMes.mes).padStart(2, '0')}-${vrMes.ano}${entityId ? `-${entityId}` : ''}.${EXTENSAO_POR_FORMATO[formato]}`
    const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : ''
    await baixarComAutenticacao(
      `${API_URL}/vr/${vrMes.id}/exportar/${formato}${qs}`,
      nomeArquivo,
      'Falha ao baixar o arquivo',
    )
  },

  async getLancamentos(vrMesId: string, entityId?: string): Promise<LancamentoVr[]> {
    const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : ''
    const response = await fetch(`${API_URL}/vr/${vrMesId}/lancamentos${qs}`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar os lançamentos')
    const json = (await response.json()) as ApiListResponse<LancamentoVr>
    return json.data
  },

  async criarLancamentosEmLote(vrMesId: string, itens: ItemLancamentoVr[]): Promise<LancamentoVr[]> {
    const response = await fetch(`${API_URL}/vr/${vrMesId}/lancamentos/lote`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ itens }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao lançar o(s) desconto(s)/extra(s)')
    const json = (await response.json()) as ApiListResponse<LancamentoVr>
    return json.data
  },

  async cancelarLancamento(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/vr/lancamentos/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao cancelar o lançamento')
  },

  async getTodosLancamentos(): Promise<LancamentoVrDetalhado[]> {
    const response = await fetch(`${API_URL}/vr/lancamentos`, { headers: authHeaders() })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar todos os lançamentos')
    const json = (await response.json()) as ApiListResponse<LancamentoVrDetalhado>
    return json.data
  },

  /**
   * Baixa em PDF os lançamentos com os MESMOS filtros que estão aplicados
   * na tela agora (nome, mês/ano, tipo, status) — o PDF sempre traz só o
   * que está sendo visualizado no momento.
   */
  async exportarTodosLancamentosPdf(filtros: {
    busca?: string
    mes?: number
    ano?: number
    tipo?: TipoLancamentoVr
    status?: 'APLICADO' | 'PENDENTE'
  }): Promise<void> {
    const params = new URLSearchParams()
    if (filtros.busca) params.set('busca', filtros.busca)
    if (filtros.mes && filtros.ano) {
      params.set('mes', String(filtros.mes))
      params.set('ano', String(filtros.ano))
    }
    if (filtros.tipo) params.set('tipo', filtros.tipo)
    if (filtros.status) params.set('status', filtros.status)

    await baixarComAutenticacao(
      `${API_URL}/vr/lancamentos/exportar/pdf?${params.toString()}`,
      'vr-lancamentos.pdf',
      'Falha ao baixar o PDF dos lançamentos',
    )
  },

  /** Simula o que o fechamento geraria, opcionalmente de 1 entidade só. */
  async preVisualizar(vrMesId: string, entityId?: string): Promise<PreVisualizacaoResultado> {
    const qs = entityId ? `?entityId=${encodeURIComponent(entityId)}` : ''
    const response = await fetch(`${API_URL}/vr/${vrMesId}/pre-visualizar${qs}`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao gerar a pré-visualização')
    const json = (await response.json()) as ApiResponse<PreVisualizacaoResultado>
    return json.data
  },
}