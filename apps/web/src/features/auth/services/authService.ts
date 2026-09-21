import { getToken } from '@/lib/auth'

/**
 * Service de autenticação local (e-mail + senha, JWT).
 * Usa a base relativa "/api" (proxy do Vite → API), evitando CORS.
 * O redirect do Microsoft SSO continua usando VITE_API_URL no LoginForm.
 */

const API_URL = '/api'

/** Header Authorization quando há token salvo. */
function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export interface AuthUser {
  id: string
  email: string
  nome: string
  setor?: string
  funcao?: string
  avatar?: string
  papelCodigo?: string
  personificadoPor?: { id: string; email: string; nome: string }
}

export interface AuthTokenResponse {
  token: string
  user: AuthUser
}

/** Modo do login local: já tem senha (login) ou 1º acesso (criar-senha). */
export type LoginMode = 'login' | 'criar-senha'

/** Extrai a mensagem de erro do corpo ({ message }) ou usa um fallback. */
async function extrairErro(response: Response, fallback: string) {
  try {
    const corpo = (await response.json()) as { message?: string }
    return corpo.message ?? fallback
  } catch {
    return fallback
  }
}

export const authService = {
  /** Login por e-mail + senha (validado no LDAP). Retorna token + usuário. */
  async login(email: string, password: string): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error(await extrairErro(response, 'Credenciais inválidas.'))
    }

    return (await response.json()) as AuthTokenResponse
  },

  /** Login do sistema (senha no banco): descobre se já tem senha ou é 1º acesso. */
  async checkEmailLocal(email: string): Promise<LoginMode> {
    const response = await fetch(`${API_URL}/auth/local/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      throw new Error(await extrairErro(response, 'Não foi possível verificar o e-mail.'))
    }

    const { mode } = (await response.json()) as { mode: LoginMode }
    return mode
  },

  /** Login do sistema (senha no banco). Retorna token + usuário. */
  async loginLocal(email: string, password: string): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_URL}/auth/local/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      throw new Error(await extrairErro(response, 'Credenciais inválidas.'))
    }

    return (await response.json()) as AuthTokenResponse
  },

  /** 1º acesso do login do sistema: define a senha e já entra. */
  async setPasswordLocal(input: {
    email: string
    password: string
  }): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_URL}/auth/local/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(await extrairErro(response, 'Não foi possível criar a senha.'))
    }

    return (await response.json()) as AuthTokenResponse
  },

  /** Atualiza o próprio perfil (só cpf/telefone). Requer estar logado. */
  async updateMeuPerfil(input: {
    cpf: string | null
    telefone: string | null
  }): Promise<void> {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      throw new Error(await extrairErro(response, 'Não foi possível salvar o perfil.'))
    }
  },

  /**
   * Personifica outro usuário (RH/Admin): troca o token pelo do usuário-alvo.
   * Todas as chamadas seguintes passam a valer para ele, não só a exibição.
   */
  async personificar(usuarioId: string): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_URL}/auth/personificar/${usuarioId}`, {
      method: 'POST',
      headers: authHeaders(),
    })

    if (!response.ok) {
      throw new Error(await extrairErro(response, 'Não foi possível personificar este usuário.'))
    }

    return (await response.json()) as AuthTokenResponse
  },

  /** Encerra a personificação ativa e volta a autenticar como o usuário real. */
  async encerrarPersonificacao(): Promise<AuthTokenResponse> {
    const response = await fetch(`${API_URL}/auth/encerrar-personificacao`, {
      method: 'POST',
      headers: authHeaders(),
    })

    if (!response.ok) {
      throw new Error(await extrairErro(response, 'Não foi possível encerrar a personificação.'))
    }

    return (await response.json()) as AuthTokenResponse
  },
}
