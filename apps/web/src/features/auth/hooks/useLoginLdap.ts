import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { authService } from '@/features/auth/services'
import { useAuth } from '@/features/auth/context'

/**
 * Login por e-mail + senha validado no LDAP (Microsoft AD).
 * Em sucesso: guarda o token e volta para a rota de origem (ou /home).
 */
export function useLoginLdap() {
  const navigate = useNavigate()
  const location = useLocation()
  const { entrar: registrarSessao } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar(email: string, senha: string) {
    setIsLoading(true)
    setErro(null)
    try {
      const { token } = await authService.login(email.trim(), senha)
      registrarSessao(token)
      const destino =
        (location.state as { from?: { pathname?: string } } | null)?.from
          ?.pathname ?? '/home'
      navigate(destino, { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível entrar.')
    } finally {
      setIsLoading(false)
    }
  }

  return { entrar, isLoading, erro }
}
