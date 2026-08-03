import type { FormEvent, KeyboardEvent } from 'react'
import { useState } from 'react'
import { AlertCircle, ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { useLoginEmailSenha } from '@/features/auth/hooks'

/** Domínio corporativo completado automaticamente ao digitar "@". */
const CORP_DOMAIN = 'adventistas.org'

interface EmailSenhaPanelProps {
  /** Volta para o login principal (LDAP). */
  onVoltar: () => void
}

/**
 * Login "do sistema": e-mail + senha guardada no banco. Passo 1: informar
 * e-mail; depois entra (já tem senha) ou cria a senha no 1º acesso.
 */
export function EmailSenhaPanel({ onVoltar }: EmailSenhaPanelProps) {
  const {
    passo,
    email,
    setEmail,
    isLoading,
    erro,
    continuar,
    entrar,
    criarSenha,
    voltarParaEmail,
  } = useLoginEmailSenha()

  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  function handleEmailKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === '@' && !email.includes('@')) {
      event.preventDefault()
      setEmail(`${email}@${CORP_DOMAIN}`)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErroLocal(null)

    if (passo === 'continuar') {
      continuar()
      return
    }

    if (passo === 'login') {
      entrar(senha)
      return
    }

    // passo 'criar'
    if (senha.length < 8) {
      setErroLocal('A senha precisa ter ao menos 8 caracteres.')
      return
    }
    if (senha !== confirmar) {
      setErroLocal('As senhas não conferem.')
      return
    }
    criarSenha({ password: senha })
  }

  const mensagemErro = erroLocal ?? erro

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="login-email">E-mail corporativo</FieldLabel>
          <Input
            id="login-email"
            name="email"
            type="email"
            placeholder={`nome@${CORP_DOMAIN}`}
            autoComplete="username"
            autoFocus
            value={email}
            disabled={passo !== 'continuar'}
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={handleEmailKeyDown}
          />
        </Field>

        {passo === 'login' || passo === 'criar' ? (
          <Field>
            <FieldLabel htmlFor="login-senha">
              {passo === 'criar' ? 'Criar senha' : 'Senha'}
            </FieldLabel>
            <Input
              id="login-senha"
              name="password"
              type="password"
              placeholder="••••••••"
              autoComplete={passo === 'criar' ? 'new-password' : 'current-password'}
              autoFocus
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
            {passo === 'criar' ? (
              <FieldDescription>Mínimo de 8 caracteres.</FieldDescription>
            ) : null}
          </Field>
        ) : null}

        {passo === 'criar' ? (
          <Field>
            <FieldLabel htmlFor="login-confirmar">Confirmar senha</FieldLabel>
            <Input
              id="login-confirmar"
              name="confirmar"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              value={confirmar}
              onChange={(event) => setConfirmar(event.target.value)}
            />
          </Field>
        ) : null}

        {mensagemErro ? (
          <div className="flex w-full items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{mensagemErro}</span>
          </div>
        ) : null}

        <Field>
          <Button type="submit" className="h-9 w-full" disabled={isLoading}>
            {passo === 'continuar'
              ? 'Continuar'
              : passo === 'login'
                ? 'Entrar'
                : 'Criar senha e entrar'}
          </Button>
        </Field>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={passo === 'continuar' ? onVoltar : voltarParaEmail}
        >
          <ArrowLeft className="size-4" />
          {passo === 'continuar' ? 'Voltar ao login principal' : 'Usar outro e-mail'}
        </Button>
      </FieldGroup>
    </form>
  )
}
