import type { ComponentProps, FormEvent, KeyboardEvent } from "react"
import { useState } from "react"
import { AlertCircle, KeyRound } from "lucide-react"

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
import { EmailSenhaPanel } from "@/features/auth/components/EmailSenhaPanel"

/** Domínio corporativo completado automaticamente ao digitar "@". */
const CORP_DOMAIN = "adventistas.org"

type MetodoLogin = "ldap" | "local"

export interface LoginFormProps extends ComponentProps<"div"> {
  /** Motivo exato de falha no login SSO (vindo da API via ?error=). */
  error?: string | null
}

/**
 * Login do ERP:
 * - Principal: e-mail + senha validados no LDAP (Microsoft AD).
 * - Secundário: SSO Microsoft OAuth (de escanteio até estar pronto).
 * - Alternativo: login "do sistema" (e-mail + senha guardada no banco).
 */
export function LoginForm({ className, error, ...props }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [senha, setSenha] = useState("")
  const [metodo, setMetodo] = useState<MetodoLogin>("ldap")
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

  function entrarComMicrosoft() {
    const apiUrl = import.meta.env.VITE_API_URL ?? ""
    const hint = encodeURIComponent(email.trim())
    window.location.href = `${apiUrl}/auth/microsoft?login_hint=${hint}`
  }

  return (
    <div className={cn("flex flex-col", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bem-vindo(a) de volta</CardTitle>
          <CardDescription>
            {metodo === "local"
              ? "Login do sistema (e-mail e senha)"
              : `Entre com sua conta institucional @${CORP_DOMAIN}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {metodo === "local" ? (
            <EmailSenhaPanel onVoltar={() => setMetodo("ldap")} />
          ) : (
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
                  {isLoading ? "Entrando…" : "Entrar"}
                </Button>
              </Field>

              <div className="flex items-center text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou
                <span className="h-px flex-1 bg-border" />
              </div>

              {/* Microsoft OAuth (SSO) — secundário, "de escanteio" por enquanto. */}
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full"
                onClick={entrarComMicrosoft}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23">
                  <path fill="#f25022" d="M1 1h10v10H1z" />
                  <path fill="#7fba00" d="M12 1h10v10H12z" />
                  <path fill="#00a4ef" d="M1 12h10v10H1z" />
                  <path fill="#ffb900" d="M12 12h10v10H12z" />
                </svg>
                Entrar com a Microsoft
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full text-muted-foreground"
                onClick={() => setMetodo("local")}
              >
                <KeyRound className="size-4" />
                Acessar com login do sistema
              </Button>

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
          )}
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
