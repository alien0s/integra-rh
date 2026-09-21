/**
 * Decodificação do JWT no cliente (sem validar assinatura — isso é papel do
 * backend em cada request). Serve só para exibir os dados e saber se há sessão.
 */

/** Identidade mínima do usuário real por trás de uma sessão personificada. */
export interface PersonificadoPor {
  id: string
  email: string
  nome: string
}

/** Usuário logado, derivado do JWT. */
export interface AuthUsuario {
  id: string
  email: string
  nome: string
  avatar?: string
  setor?: string
  funcao?: string
  papelCodigo?: string
  /**
   * Presente quando esta sessão é uma personificação: quem é o usuário real
   * (que iniciou a personificação), para exibir na UI e voltar a ele depois.
   */
  personificadoPor?: PersonificadoPor
  /** Iniciais para o fallback do avatar (ex.: "EF"). */
  iniciais: string
}

interface JwtPayload {
  id: string
  email: string
  nome: string
  avatar?: string
  setor?: string
  funcao?: string
  papelCodigo?: string
  personificadoPor?: PersonificadoPor
  exp?: number
}

/** Decodifica o payload (base64url + UTF-8) do JWT. */
function decodificarPayload(token: string): JwtPayload | null {
  try {
    const parte = token.split('.')[1]
    if (!parte) return null
    const base64 = parte.replace(/-/g, '+').replace(/_/g, '/')
    const binario = atob(base64)
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as JwtPayload
  } catch {
    return null
  }
}

/** Primeira + última inicial do nome (ex.: "Enos Cardoso de Franca" → "EF"). */
function calcularIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Converte um token em AuthUsuario, ou null se ausente/inválido/expirado.
 */
export function usuarioDoToken(token: string | null): AuthUsuario | null {
  if (!token) return null

  const payload = decodificarPayload(token)
  if (!payload?.id || !payload.email) return null

  // Token expirado → tratar como deslogado.
  if (payload.exp && payload.exp * 1000 <= Date.now()) return null

  const nome = payload.nome || payload.email.split('@')[0]
  return {
    id: payload.id,
    email: payload.email,
    nome,
    avatar: payload.avatar,
    setor: payload.setor,
    funcao: payload.funcao,
    papelCodigo: payload.papelCodigo,
    personificadoPor: payload.personificadoPor,
    iniciais: calcularIniciais(nome),
  }
}
