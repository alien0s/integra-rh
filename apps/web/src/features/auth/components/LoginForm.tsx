import type { ComponentProps, FormEvent, KeyboardEvent } from "react"
import { useState } from "react"
import { AlertCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { useLoginLdap } from "@/features/auth/hooks"

/** Domínio corporativo completado automaticamente ao digitar "@". */
const CORP_DOMAIN = "adventistas.org"

export interface LoginFormProps extends ComponentProps<"div"> {
  /** Motivo exato de falha no login SSO (vindo da API via ?error=). */
  error?: string | null
}

/**
 * Login do ERP: e-mail + senha validados no LDAP (Microsoft AD).
 */
export function LoginForm({ className, error, ...props }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const { entrar, isLoading, erro } = useLoginLdap()

  const podeEntrar = email.trim().length > 0 && senha.length > 0

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!podeEntrar || isLoading) return
    entrar(email, senha)
  }

  function handleEmailKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Ao digitar "@", reconhece o email corporativo e completa o domínio.
    if (event.key === "@" && !email.includes("@")) {
      event.preventDefault()
      setEmail(`${email}@${CORP_DOMAIN}`)
    }
  }

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bem-vindo(a) de volta</CardTitle>
          <CardDescription>
            {`Entre com sua conta institucional @${CORP_DOMAIN}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">E-mail corporativo</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder={`nome@${CORP_DOMAIN}`}
                  autoComplete="username"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={handleEmailKeyDown}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="senha">Senha</FieldLabel>
                <Input
                  id="senha"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                />
              </Field>

              {erro ? (
                <div className="flex w-full items-center rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>{erro}</span>
                </div>
              ) : null}

              <Field>
                <Button
                  className="h-9 w-full"
                  type="submit"
                  disabled={!podeEntrar || isLoading}
                >
                  {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                  {isLoading ? "Entrando…" : "Entrar"}
                </Button>
              </Field>

              {error ? (
                <TooltipProvider>
                  <Tooltip className="w-full">
                    <TooltipTrigger>
                      <div className="flex w-full items-center rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <AlertCircle className="size-4 shrink-0" />
                        <span className="truncate">
                          Falha no login Microsoft.{" "}
                          <span className="underline underline-offset-2">
                            Ver motivo
                          </span>
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      className="max-w-xs whitespace-normal text-left leading-snug"
                    >
                      {error}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : null}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Ao continuar, você concorda com nossos{" "}
        <a href="#">Termos de Uso</a> e{" "}
        <a href="#">Política de Privacidade</a>.
      </FieldDescription>
    </div>
  )
}
