import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { authService } from '@/features/auth/services'
import { useAuth } from '@/features/auth/context/AuthContext'

/** Dados mínimos do usuário sendo personificado (para exibição na UI). */
export interface UsuarioPersonificado {
  id: string
  nome: string
  email: string
  avatarUrl?: string
  iniciais: string
}

/** Identidade mínima de quem iniciou a personificação. */
export interface AtorOriginal {
  id: string
  nome: string
  email: string
}

interface PersonificacaoContextValue {
  /** Usuário atualmente personificado (a própria identidade do token), ou null. */
  personificado: UsuarioPersonificado | null
  /** Quem é o usuário real por trás da personificação, ou null. */
  atorOriginal: AtorOriginal | null
  /** Há personificação ativa. */
  ativo: boolean
  /** Erro da última tentativa de iniciar/encerrar (ex.: sem permissão). */
  erro: string | null
  /** Passa a personificar um usuário (troca o token pelo dele). */
  personificar: (usuarioId: string) => Promise<void>
  /** Encerra a personificação (volta a autenticar como o usuário real). */
  encerrar: () => Promise<void>
}

const PersonificacaoContext = createContext<PersonificacaoContextValue | null>(null)

/**
 * Provê o estado de "personificação" (acessar o sistema como outro usuário).
 *
 * Diferente da versão anterior (só cosmética), aqui a personificação troca de
 * verdade o token JWT ativo pelo do usuário-alvo — por isso TODAS as chamadas
 * à API (férias, uploads, etc.) passam a valer para ele automaticamente, sem
 * cada tela precisar saber que existe personificação. O estado "quem estou
 * personificando" vem direto do token decodificado (via useAuth()), não de um
 * armazenamento separado — não tem como os dois divergirem.
 */
export function PersonificacaoProvider({ children }: { children: ReactNode }) {
  const { usuario, entrar } = useAuth()
  const [erro, setErro] = useState<string | null>(null)

  const personificadoPor = usuario?.personificadoPor ?? null

  const personificado = useMemo<UsuarioPersonificado | null>(() => {
    if (!usuario || !personificadoPor) return null
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatarUrl: usuario.avatar,
      iniciais: usuario.iniciais,
    }
  }, [usuario, personificadoPor])

  const personificar = useCallback(
    async (usuarioId: string) => {
      setErro(null)
      try {
        const { token } = await authService.personificar(usuarioId)
        entrar(token)
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Não foi possível personificar este usuário.')
        throw e
      }
    },
    [entrar],
  )

  const encerrar = useCallback(async () => {
    setErro(null)
    try {
      const { token } = await authService.encerrarPersonificacao()
      entrar(token)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível encerrar a personificação.')
      throw e
    }
  }, [entrar])

  const value = useMemo<PersonificacaoContextValue>(
    () => ({
      personificado,
      atorOriginal: personificadoPor,
      ativo: personificadoPor !== null,
      erro,
      personificar,
      encerrar,
    }),
    [personificado, personificadoPor, erro, personificar, encerrar],
  )

  return (
    <PersonificacaoContext.Provider value={value}>{children}</PersonificacaoContext.Provider>
  )
}

/** Acessa o contexto de personificação. */
export function usePersonificacao(): PersonificacaoContextValue {
  const ctx = useContext(PersonificacaoContext)
  if (!ctx) {
    throw new Error('usePersonificacao deve ser usado dentro de <PersonificacaoProvider>.')
  }
  return ctx
}
