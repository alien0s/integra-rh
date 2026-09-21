import { getToken } from '@/lib/auth'
import type { Aniversariante, DashboardData, FeriasStatusMock } from '../types'

/**
 * Service do dashboard (Home). Comunicados já vêm da API real
 * (GET /comunicados/ativos, no mesmo padrão de cursosService.ts). Eventos,
 * férias e aniversariantes continuam mock até esses módulos serem ligados.
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

const feriasMock: FeriasStatusMock = {
  diasParaFerias: 18,
  periodo: '10 – 30 de novembro',
}

const aniversariantesMock: Aniversariante[] = [
  { id: '1', nome: 'Beatriz Lima', data: '3 de setembro', fotoUrl: 'https://i.pravatar.cc/150?img=5', iniciais: 'BL' },
  { id: '2', nome: 'Rafael Souza', data: '12 de setembro', fotoUrl: 'https://i.pravatar.cc/150?img=13', iniciais: 'RS' },
  { id: '3', nome: 'Camila Torres', data: '20 de setembro', fotoUrl: 'https://i.pravatar.cc/150?img=25', iniciais: 'CT' },
  { id: '4', nome: 'Diego Ferreira', data: '27 de setembro', fotoUrl: 'https://i.pravatar.cc/150?img=33', iniciais: 'DF' },
]

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

export const homeService = {
  /** Dados completos do dashboard (comunicados reais; resto ainda mock). */
  async getDashboardData(): Promise<DashboardData> {
    const comunicados = await getComunicadosAtivos()

    return {
      comunicados,
      ferias: feriasMock,
      aniversariantes: aniversariantesMock,
    }
  },
}
