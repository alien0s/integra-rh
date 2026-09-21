import { getToken } from '@/lib/auth'
import type {
  CursoQualificacao,
  FormacaoAcademica,
  FuncionarioQualificacoes,
  Idioma,
  NovaFormacaoInput,
  NovoCursoInput,
  NovoIdiomaInput,
  QualificacoesDeUsuario,
  QualificacoesResumo,
} from '../types'

/**
 * Service de Cursos e Qualificações — chamadas HTTP à API (via proxy /api).
 * Sem estado/UI.
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

function resolverAvatar(url: string): string {
  if (!url) return ''
  if (url.startsWith('http') || url.startsWith('data:')) return url
  return `${API_URL}${url}`
}

interface MinhasQualificacoes {
  formacoes: FormacaoAcademica[]
  cursos: CursoQualificacao[]
  idiomas: Idioma[]
}

export const cursosService = {
  /** Estatísticas agregadas (cards do topo da Visão geral). */
  async getResumo(): Promise<QualificacoesResumo> {
    const response = await fetch(`${API_URL}/qualificacoes/resumo`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar o resumo')
    const json = (await response.json()) as ApiResponse<QualificacoesResumo>
    return json.data
  },

  /** Colaboradores com a contagem de qualificações aprovadas (tabela da Visão geral). */
  async getFuncionarios(): Promise<FuncionarioQualificacoes[]> {
    const response = await fetch(`${API_URL}/qualificacoes/funcionarios`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar funcionários')
    const json = (await response.json()) as ApiListResponse<FuncionarioQualificacoes>
    return json.data.map((f) => ({ ...f, fotoUrl: resolverAvatar(f.fotoUrl) }))
  },

  /** Minhas qualificações (aba Pessoal — inclui pendentes/recusadas). */
  async getMinhas(): Promise<MinhasQualificacoes> {
    const response = await fetch(`${API_URL}/qualificacoes/minhas`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar suas qualificações')
    const json = (await response.json()) as ApiResponse<MinhasQualificacoes>
    return json.data
  },

  /** Qualificações aprovadas de outro colaborador (linha expandida da tabela). */
  async getDeUsuario(usuarioId: string): Promise<QualificacoesDeUsuario> {
    const response = await fetch(`${API_URL}/qualificacoes/usuario/${usuarioId}`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao buscar qualificações do colaborador')
    const json = (await response.json()) as ApiResponse<QualificacoesDeUsuario>
    return json.data
  },

  async criarFormacao(input: NovaFormacaoInput): Promise<FormacaoAcademica> {
    const response = await fetch(`${API_URL}/qualificacoes/formacoes`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao cadastrar a formação')
    const json = (await response.json()) as ApiResponse<FormacaoAcademica>
    return json.data
  },

  async excluirFormacao(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/qualificacoes/formacoes/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao excluir a formação')
  },

  async criarCurso(input: NovoCursoInput): Promise<CursoQualificacao> {
    const response = await fetch(`${API_URL}/qualificacoes/cursos`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify(input),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao cadastrar o registro')
    const json = (await response.json()) as ApiResponse<CursoQualificacao>
    return json.data
  },

  async excluirCurso(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/qualificacoes/cursos/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao excluir o registro')
  },

  async criarOuAtualizarIdioma(input: NovoIdiomaInput): Promise<Idioma> {
    const response = await fetch(`${API_URL}/qualificacoes/idiomas`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({ ...input, origemAvaliacao: 'AUTODECLARADO' }),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao cadastrar o idioma')
    const json = (await response.json()) as ApiResponse<Idioma>
    return json.data
  },

  async excluirIdioma(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/qualificacoes/idiomas/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao excluir o idioma')
  },

  /** Envia (ou troca) o diploma/comprovante de uma formação acadêmica. */
  async enviarAnexoFormacao(id: string, arquivo: File): Promise<FormacaoAcademica> {
    const formData = new FormData()
    formData.append('diploma', arquivo)
    const response = await fetch(`${API_URL}/qualificacoes/formacoes/${id}/anexo`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    })
    if (!response.ok) return lancarErro(response, 'Falha ao enviar o diploma')
    const json = (await response.json()) as ApiResponse<FormacaoAcademica>
    return json.data
  },

  /** Baixa o diploma/comprovante de uma formação acadêmica (blob autenticado). */
  async baixarAnexoFormacao(id: string): Promise<Blob> {
    const response = await fetch(`${API_URL}/qualificacoes/formacoes/${id}/anexo`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao baixar o diploma')
    return response.blob()
  },

  /** Envia (ou troca) o certificado de um curso/workshop/certificação. */
  async enviarCertificadoCurso(id: string, arquivo: File): Promise<CursoQualificacao> {
    const formData = new FormData()
    formData.append('certificado', arquivo)
    const response = await fetch(`${API_URL}/qualificacoes/cursos/${id}/anexo`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    })
    if (!response.ok) return lancarErro(response, 'Falha ao enviar o certificado')
    const json = (await response.json()) as ApiResponse<CursoQualificacao>
    return json.data
  },

  /** Baixa o certificado de um curso/workshop/certificação (blob autenticado). */
  async baixarCertificadoCurso(id: string): Promise<Blob> {
    const response = await fetch(`${API_URL}/qualificacoes/cursos/${id}/anexo`, {
      headers: authHeaders(),
    })
    if (!response.ok) return lancarErro(response, 'Falha ao baixar o certificado')
    return response.blob()
  },
}
