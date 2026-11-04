import { getToken } from '@/lib/auth'
import type {
  Entidade,
  EntidadeInput,
  Funcao,
  FuncaoInput,
  ModuloVisibilidade,
  Papel,
  PapelInput,
  Setor,
  SetorInput,
} from '@/features/tabelas/types'

/**
 * Service de Tabelas — chamadas HTTP puras à API para o CRUD das tabelas de
 * apoio (entidades, setores, funções, papéis) usadas pela tela
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
const setoresCrud = criarClienteCrud<Setor, SetorInput>('setores')
const funcoesCrud = criarClienteCrud<Funcao, FuncaoInput>('funcoes')
const papeisCrud = criarClienteCrud<Papel, PapelInput>('papeis')

/**
 * Visibilidade de módulos (sidebar + rota) por papel — não é um CRUD simples
 * (recurso identificado por dois ids, não um só), por isso não usa
 * `criarClienteCrud`.
 */
async function getModulosVisibilidade(): Promise<ModuloVisibilidade[]> {
  const response = await fetch(`${API_URL}/tabelas/modulos-visibilidade`, {
    headers: authHeaders(),
  })
  if (!response.ok) return lancarErro(response, 'Falha ao buscar a visibilidade dos módulos')
  const json = (await response.json()) as ApiListResponse<ModuloVisibilidade>
  return json.data
}

async function definirVisibilidadeModulo(
  moduloCodigo: string,
  roleId: string,
  visivel: boolean,
): Promise<ModuloVisibilidade> {
  const response = await fetch(
    `${API_URL}/tabelas/modulos-visibilidade/${moduloCodigo}/${roleId}`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ visivel }),
    },
  )
  if (!response.ok) return lancarErro(response, 'Falha ao atualizar a visibilidade do módulo')
  const json = (await response.json()) as ApiResponse<ModuloVisibilidade>
  return json.data
}

/** Libera (ou não) um módulo antecipadamente pra um papel, durante o lançamento beta. */
async function definirLiberadoAntecipadoModulo(
  moduloCodigo: string,
  roleId: string,
  liberadoAntecipado: boolean,
): Promise<ModuloVisibilidade> {
  const response = await fetch(
    `${API_URL}/tabelas/modulos-visibilidade/${moduloCodigo}/${roleId}/liberado-antecipado`,
    {
      method: 'PATCH',
      headers: jsonHeaders(),
      body: JSON.stringify({ liberadoAntecipado }),
    },
  )
  if (!response.ok) return lancarErro(response, 'Falha ao atualizar a liberação antecipada do módulo')
  const json = (await response.json()) as ApiResponse<ModuloVisibilidade>
  return json.data
}

export const tabelasService = {
  getEntidades: entidadesCrud.listar,
  criarEntidade: entidadesCrud.criar,
  atualizarEntidade: entidadesCrud.atualizar,
  excluirEntidade: entidadesCrud.excluir,

  getSetores: setoresCrud.listar,
  criarSetor: setoresCrud.criar,
  atualizarSetor: setoresCrud.atualizar,
  excluirSetor: setoresCrud.excluir,

  getFuncoes: funcoesCrud.listar,
  criarFuncao: funcoesCrud.criar,
  atualizarFuncao: funcoesCrud.atualizar,
  excluirFuncao: funcoesCrud.excluir,

  getPapeis: papeisCrud.listar,
  criarPapel: papeisCrud.criar,
  atualizarPapel: papeisCrud.atualizar,
  excluirPapel: papeisCrud.excluir,

  getModulosVisibilidade,
  definirVisibilidadeModulo,
  definirLiberadoAntecipadoModulo,
}
