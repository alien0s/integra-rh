import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** Dados mínimos do usuário sendo personificado (para exibição na UI). */
export interface UsuarioPersonificado {
  id: string
  nome: string
  email: string
  avatarUrl?: string
  iniciais: string
}

interface PersonificacaoContextValue {
  /** Usuário atualmente personificado, ou null. */
  personificado: UsuarioPersonificado | null
  /** Há personificação ativa. */
  ativo: boolean
  /** Passa a personificar um usuário. */
  personificar: (usuario: UsuarioPersonificado) => void
  /** Encerra a personificação (volta a ser o usuário logado). */
  encerrar: () => void
}

const STORAGE_KEY = 'personificacao'

const PersonificacaoContext =
  createContext<PersonificacaoContextValue | null>(null)

/** Lê o estado inicial do sessionStorage (sobrevive a reloads na aba). */
function lerInicial(): UsuarioPersonificado | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UsuarioPersonificado) : null
  } catch {
    return null
  }
}

/**
 * Provê o estado de "personificação" (acessar o sistema como outro usuário).
 * Persistido em sessionStorage para sobreviver às remontagens/reloads da aba.
 */
export function PersonificacaoProvider({ children }: { children: ReactNode }) {
  const [personificado, setPersonificado] = useState<UsuarioPersonificado | null>(
    lerInicial,
  )

  const personificar = useCallback((usuario: UsuarioPersonificado) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(usuario))
    setPersonificado(usuario)
  }, [])

  const encerrar = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setPersonificado(null)
  }, [])

  const value = useMemo<PersonificacaoContextValue>(
    () => ({
      personificado,
      ativo: personificado !== null,
      personificar,
      encerrar,
    }),
    [personificado, personificar, encerrar],
  )

  return (
    <PersonificacaoContext.Provider value={value}>
      {children}
    </PersonificacaoContext.Provider>
  )
}

/** Acessa o contexto de personificação. */
export function usePersonificacao(): PersonificacaoContextValue {
  const ctx = useContext(PersonificacaoContext)
  if (!ctx) {
    throw new Error(
      'usePersonificacao deve ser usado dentro de <PersonificacaoProvider>.',
    )
  }
  return ctx
}
