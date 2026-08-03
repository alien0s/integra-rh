import { getToken } from '@/lib/auth'
import type {
  AtualizarUsuarioInput,
  OpcaoSelecao,
  Usuario,
} from '@/features/usuarios/types'

/**
 * Service de Usuários — chamadas HTTP puras à API (sem estado/UI).
 * A API retorna os campos já no formato do tipo `Usuario`.
 */

// Base relativa que passa pelo proxy do Vite (/api → API). Usar caminho
// relativo evita CORS e funciona tanto via localhost quanto pelo IP da VM,
// pois a requisição sai da mesma origem do front.
const API_URL = '/api'

/** Monta o header Authorization quando há token salvo (no-op em modo dev). */
function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Resolve o fotoUrl vindo da API:
 * - vazio                    → "" (fallback com iniciais)
 * - data URI / http(s)       → usado como está
 * - caminho da API (/usu...) → prefixa com a base "/api" (passa pelo proxy)
 */
function resolverFotoUrl(valor: string): string {
  if (!valor) return ''
  if (valor.startsWith('http') || valor.startsWith('data:')) return valor
  return `${API_URL}${valor}`
}

interface ApiResponse<T> {
  data: T
}

interface ApiListResponse<T> {
  data: T[]
  total: number
}

export const usuariosService = {
  /**
   * Busca a lista completa de usuários.
   */
  async getUsuarios(): Promise<Usuario[]> {
    const response = await fetch(`${API_URL}/usuarios`, {
      headers: authHeaders(),
    })

    if (!response.ok) {
      throw new Error('Falha ao buscar usuários')
    }

    const json = (await response.json()) as ApiListResponse<Usuario>
    return json.data.map((u) => ({ ...u, fotoUrl: resolverFotoUrl(u.fotoUrl) }))
  },

  /**
   * Busca um usuário pelo id.
   */
  async getUsuario(id: string): Promise<Usuario> {
    const response = await fetch(`${API_URL}/usuarios/${id}`, {
      headers: authHeaders(),
    })

    if (!response.ok) {
      throw new Error('Falha ao buscar usuário')
    }

    const json = (await response.json()) as ApiResponse<Usuario>
    return { ...json.data, fotoUrl: resolverFotoUrl(json.data.fotoUrl) }
  },

  /**
   * Envia a foto recortada (multipart) e retorna a URL exibível do avatar.
   * Não definimos Content-Type — o browser monta o boundary do multipart.
   */
  async uploadAvatar(id: string, blob: Blob): Promise<{ url: string }> {
    const form = new FormData()
    form.append('file', blob, 'avatar.jpg')

    const response = await fetch(`${API_URL}/usuarios/${id}/avatar`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    })

    if (!response.ok) {
      throw new Error('Falha ao enviar a foto')
    }

    const json = (await response.json()) as { url: string }
    // ?t=timestamp fura o cache do navegador para exibir a foto nova na hora
    // (a URL do avatar é estável, então sem isso viria a versão em cache).
    const url = resolverFotoUrl(json.url)
    const separador = url.includes('?') ? '&' : '?'
    return { url: `${url}${separador}t=${Date.now()}` }
  },

  /**
   * Lista os departamentos (opções do dropdown de edição).
   */
  async getDepartamentos(): Promise<OpcaoSelecao[]> {
    const response = await fetch(`${API_URL}/departamentos`, {
      headers: authHeaders(),
    })

    if (!response.ok) {
      throw new Error('Falha ao buscar departamentos')
    }

    const json = (await response.json()) as ApiListResponse<OpcaoSelecao>
    return json.data
  },

  /**
   * Lista as funções (opções do dropdown de edição).
   */
  async getFuncoes(): Promise<OpcaoSelecao[]> {
    const response = await fetch(`${API_URL}/funcoes`, {
      headers: authHeaders(),
    })

    if (!response.ok) {
      throw new Error('Falha ao buscar funções')
    }

    const json = (await response.json()) as ApiListResponse<OpcaoSelecao>
    return json.data
  },

  /**
   * Atualiza os campos editáveis do usuário e retorna o registro atualizado.
   */
  async atualizarUsuario(
    id: string,
    input: AtualizarUsuarioInput,
  ): Promise<Usuario> {
    const response = await fetch(`${API_URL}/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const erro = (await response.json().catch(() => null)) as {
        message?: string
      } | null
      throw new Error(erro?.message ?? 'Falha ao atualizar usuário')
    }

    const json = (await response.json()) as ApiResponse<Usuario>
    return { ...json.data, fotoUrl: resolverFotoUrl(json.data.fotoUrl) }
  },
}
