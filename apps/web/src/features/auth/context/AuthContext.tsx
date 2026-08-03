import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  clearToken,
  getToken,
  setToken,
  TOKEN_KEY,
} from '@/lib/auth'
import { limparCacheUsuarioLogado } from '@/features/auth/hooks/useUsuarioLogado'
import { usuarioDoToken, type AuthUsuario } from '@/features/auth/lib/token'

interface AuthContextValue {
  /** Usuário logado (do JWT) ou null. */
  usuario: AuthUsuario | null
  /** Há sessão válida (token presente e não expirado). */
  isAuthenticated: boolean
  /** Registra a sessão a partir de um token (login). */
  entrar: (token: string) => void
  /** Encerra a sessão (logout). */
  sair: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Provê o estado de autenticação (token → usuário) de forma reativa, para as
 * rotas protegidas e o restante da UI. Fonte única de verdade da sessão.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())

  const usuario = useMemo(() => usuarioDoToken(token), [token])

  const entrar = useCallback((novoToken: string) => {
    setToken(novoToken)
    setTokenState(novoToken)
  }, [])

  const sair = useCallback(() => {
    clearToken()
    limparCacheUsuarioLogado()
    setTokenState(null)
  }, [])

  // Sincroniza logout/login feitos em outra aba.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === TOKEN_KEY) setTokenState(getToken())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ usuario, isAuthenticated: usuario !== null, entrar, sair }),
    [usuario, entrar, sair],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Acessa o contexto de autenticação. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de <AuthProvider>.')
  }
  return ctx
}
