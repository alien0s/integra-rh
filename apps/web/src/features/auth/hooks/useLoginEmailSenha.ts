import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { authService } from '@/features/auth/services'
import { useAuth } from '@/features/auth/context'

/** Passo atual do fluxo de login "do sistema" (senha no banco). */
export type PassoLogin = 'continuar' | 'login' | 'criar'

/**
 * Login do sistema (e-mail + senha no banco): informar e-mail → entrar (já tem
 * senha) ou criar senha (1º acesso). Em sucesso, guarda o token e navega.
 */
export function useLoginEmailSenha() {
  const navigate = useNavigate()
  const location = useLocation()
  const { entrar: registrarSessao } = useAuth()
  const [passo, setPasso] = useState<PassoLogin>('continuar')
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function entrarComToken(token: string) {
    registrarSessao(token)
    const destino =
      (location.state as { from?: { pathname?: string } } | null)?.from
        ?.pathname ?? '/home'
    navigate(destino, { replace: true })
  }

  /** Passo 1: verifica o e-mail e decide o próximo passo. */
  async function continuar() {
    const alvo = email.trim().toLowerCase()
    if (!alvo) return

    setIsLoading(true)
    setErro(null)
    try {
      const mode = await authService.checkEmailLocal(alvo)
      setEmail(alvo)
      setPasso(mode === 'login' ? 'login' : 'criar')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao verificar o e-mail.')
    } finally {
      setIsLoading(false)
    }
  }

  /** Passo 'login': autentica com a senha do banco. */
  async function entrar(password: string) {
    setIsLoading(true)
    setErro(null)
    try {
      const { token } = await authService.loginLocal(email, password)
      entrarComToken(token)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Credenciais inválidas.')
    } finally {
      setIsLoading(false)
    }
  }

  /** Passo 'criar': define a senha (1º acesso) e já entra. */
  async function criarSenha(input: { password: string }) {
    setIsLoading(true)
    setErro(null)
    try {
      const { token } = await authService.setPasswordLocal({ email, ...input })
      entrarComToken(token)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar a senha.')
    } finally {
      setIsLoading(false)
    }
  }

  /** Volta ao passo do e-mail (limpa erro). */
  function voltarParaEmail() {
    setPasso('continuar')
    setErro(null)
  }

  return {
    passo,
    email,
    setEmail,
    isLoading,
    erro,
    continuar,
    entrar,
    criarSenha,
    voltarParaEmail,
  }
}
