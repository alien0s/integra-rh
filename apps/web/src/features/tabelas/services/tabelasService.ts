import { getToken } from '@/lib/auth'
import type {
  Departamento,
  DepartamentoInput,
  Entidade,
  EntidadeInput,
  Funcao,
  FuncaoInput,
  Papel,
  PapelInput,
} from '@/features/tabelas/types'

/**
 * Service de Tabelas — chamadas HTTP puras à API para o CRUD das tabelas de
 * apoio (entidades, departamentos, funções, papéis) usadas pela tela
 * administrativa /tabelas.
 */

// Base relativa que passa pelo proxy do Vite (/api → API).
const API_URL = '/api'

/** Monta o header Authorization quando há token salvo (no-op em modo dev). */
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

/** Lê a mensagem de erro do corpo da resposta (quando houver) e lança. */
async function lancarErro(response: Response, fallback: string): Promise<never> {
  const erro = (await response.json().catch(() => null)) as { message?: string } | null
  throw new Error(erro?.message ?? fallback)
}

/**
 * Fábrica de um cliente CRUD genérico para um recurso em `/tabelas/<recurso>`.
 * As quatro tabelas de apoio seguem o mesmo contrato REST, então evitamos
 * repetir os mesmos quatro métodos (listar/criar/atualizar/excluir) quatro
 * vezes.
 */
function criarClienteCrud<T, TInput>(recurso: string) {
  const base = `${API_URL}/tabelas/${recurso}`

  return {
    async listar(): Promise<T[]> {
      const response = await fetch(base, { headers: authHeaders() })
      if (!response.ok) return lancarErro(response, `Falha ao buscar ${recurso}`)
      const json = (await response.json()) as ApiListResponse<T>
      return json.data
    },

    async criar(input: TInput): Promise<T> {
      const response = await fetch(base, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify(input),
      })
      if (!response.ok) return lancarErro(response, `Falha ao criar registro em ${recurso}`)
      const json = (await response.json()) as ApiResponse<T>
      return json.data
    },

    async atualizar(id: string, input: TInput): Promise<T> {
      const response = await fetch(`${base}/${id}`, {
        method: 'PATCH',
        headers: jsonHeaders(),
        body: JSON.stringify(input),
      })
      if (!response.ok) return lancarErro(response, `Falha ao atualizar registro em ${recurso}`)
      const json = (await response.json()) as ApiResponse<T>
      return json.data
    },

    async excluir(id: string): Promise<void> {
      const response = await fetch(`${base}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
      if (!response.ok) return lancarErro(response, `Falha ao excluir registro em ${recurso}`)
    },
  }
}

const entidadesCrud = criarClienteCrud<Entidade, EntidadeInput>('entidades')
const departamentosCrud = criarClienteCrud<Departamento, DepartamentoInput>('departamentos')
const funcoesCrud = criarClienteCrud<Funcao, FuncaoInput>('funcoes')
const papeisCrud = criarClienteCrud<Papel, PapelInput>('papeis')

export const tabelasService = {
  getEntidades: entidadesCrud.listar,
  criarEntidade: entidadesCrud.criar,
  atualizarEntidade: entidadesCrud.atualizar,
  excluirEntidade: entidadesCrud.excluir,

  getDepartamentos: departamentosCrud.listar,
  criarDepartamento: departamentosCrud.criar,
  atualizarDepartamento: departamentosCrud.atualizar,
  excluirDepartamento: departamentosCrud.excluir,

  getFuncoes: funcoesCrud.listar,
  criarFuncao: funcoesCrud.criar,
  atualizarFuncao: funcoesCrud.atualizar,
  excluirFuncao: funcoesCrud.excluir,

  getPapeis: papeisCrud.listar,
  criarPapel: papeisCrud.criar,
  atualizarPapel: papeisCrud.atualizar,
  excluirPapel: papeisCrud.excluir,
}
