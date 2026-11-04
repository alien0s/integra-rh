import { getToken } from '@/lib/auth'
import { feriasService } from '@/features/ferias/services'
import type { Aniversariante, DashboardData, FeriasStatus } from '../types'

/**
 * Service do dashboard (Home). Comunicados, férias e aniversariantes já vêm
 * da API real. Eventos continuam mock até esse módulo ser ligado.
 */

const API_URL = '/api'

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
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

/** Formato bruto de um comunicado como a API devolve (GET /comunicados/ativos). */
interface ComunicadoAtivoApi {
  id: number
  titulo: string
  descricao: string
  dataInicio: string | null
  dataFim: string | null
  recorrente: boolean
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6 | null
  anexoTipo: 'IMAGEM' | 'PDF' | null
}

const DIAS_SEMANA_LABEL: Record<number, string> = {
  0: 'Todo domingo',
  1: 'Toda segunda-feira',
  2: 'Toda terça-feira',
  3: 'Toda quarta-feira',
  4: 'Toda quinta-feira',
  5: 'Toda sexta-feira',
  6: 'Todo sábado',
}

/** Formata a data (venha como "2026-09-15" ou "2026-09-15T00:00:00.000Z") pra "15/09/2026". */
function formatarData(dataIso: string): string {
  // timeZone: 'UTC' evita a data "voltar" um dia por causa do fuso local,
  // já que a coluna é DATE puro (meia-noite UTC), sem hora de verdade.
  return new Date(dataIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

async function getComunicadosAtivos(): Promise<DashboardData['comunicados']> {
  const response = await fetch(`${API_URL}/comunicados/ativos`, {
    headers: authHeaders(),
  })
  if (!response.ok) return lancarErro(response, 'Falha ao buscar os comunicados')
  const json = (await response.json()) as ApiListResponse<ComunicadoAtivoApi>
  return json.data.map((c) => ({
    id: String(c.id),
    titulo: c.titulo,
    data: c.recorrente && c.diaSemana !== null ? DIAS_SEMANA_LABEL[c.diaSemana] : formatarData(c.dataInicio!),
    resumo: c.descricao,
    anexoTipo: c.anexoTipo,
  }))
}

async function getAniversariantesDoMes(): Promise<Aniversariante[]> {
  const response = await fetch(`${API_URL}/usuarios/aniversariantes`, {
    headers: authHeaders(),
  })
  if (!response.ok) return lancarErro(response, 'Falha ao buscar os aniversariantes')
  const json = (await response.json()) as ApiListResponse<Aniversariante>
  return json.data
}

async function getFeriasStatus(): Promise<FeriasStatus> {
  const resumo = await feriasService.getResumo()
  return resumo.proximaAprovada
    ? {
        diasParaFerias: resumo.proximaAprovada.diasParaInicio,
        periodo: resumo.proximaAprovada.periodo,
      }
    : { diasParaFerias: null }
}

export const homeService = {
  /** Dados completos do dashboard (comunicados, férias e aniversariantes reais). */
  async getDashboardData(): Promise<DashboardData> {
    const [comunicados, ferias, aniversariantes] = await Promise.all([
      getComunicadosAtivos(),
      getFeriasStatus(),
      getAniversariantesDoMes(),
    ])

    return { comunicados, ferias, aniversariantes }
  },

  /**
   * Só o status de férias — usado pra atualizar o card em tempo real (ver
   * useHomeDashboard) sem recarregar comunicados/aniversariantes junto.
   */
  getFeriasStatus,
}
