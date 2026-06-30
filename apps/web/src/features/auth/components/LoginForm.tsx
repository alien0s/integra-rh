import type { ComponentProps, FormEvent, KeyboardEvent } from "react"
import { useState } from "react"
import { AlertCircle } from "lucide-react"

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

/** Domínio corporativo completado automaticamente ao digitar "@". */
const CORP_DOMAIN = "adventistas.org"

export interface LoginFormProps extends ComponentProps<"div"> {
  /** Motivo exato de falha no login (vindo da API via ?error=). */
  error?: string | null
}

/**
 * Login do ERP via SSO da Microsoft. O usuário informa o email aqui (usado como
 * login_hint) e a senha/MFA acontecem na Microsoft. Ao final, a API redireciona
 * de volta para /login com ?token= ou ?error=.
 */
export function LoginForm({ className, error, ...props }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const podeEntrar = email.trim().length > 0

  function redirecionarParaMicrosoft() {
    const apiUrl = import.meta.env.VITE_API_URL ?? ""
    const hint = encodeURIComponent(email.trim())
    window.location.href = `${apiUrl}/auth/microsoft?login_hint=${hint}`
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!podeEntrar) return
    redirecionarParaMicrosoft()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Ao digitar "@", reconhece o email corporativo e completa o domínio.
    if (event.key === "@" && !email.includes("@")) {
      event.preventDefault()
      setEmail(`${email}@${CORP_DOMAIN}`)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Bem-vindo(a) de volta</CardTitle>
          <CardDescription>
            Entre com sua conta institucional @{CORP_DOMAIN}
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
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </Field>

              <Field>
                <Button
                  className="h-9 w-full"
                  variant="outline"
                  type="submit"
                  disabled={!podeEntrar}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 23 23">
                    <path fill="#f25022" d="M1 1h10v10H1z" />
                    <path fill="#7fba00" d="M12 1h10v10H12z" />
                    <path fill="#00a4ef" d="M1 12h10v10H1z" />
                    <path fill="#ffb900" d="M12 12h10v10H12z" />
                  </svg>
                  Entrar com a Microsoft
                </Button>
              </Field>

              {error ? (
              <TooltipProvider>
                <Tooltip className="w-full">
                  <TooltipTrigger>
                    <div className="flex w-full items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="size-4 shrink-0" />
                      <span className="truncate">
                        Não foi possível entrar.{" "}
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

              <FieldDescription className="text-center">
                O acesso é liberado pela TI/RH. Em caso de problema, fale com o
                suporte.
              </FieldDescription>
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
