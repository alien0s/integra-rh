import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

import { AppLogo } from "@/features/app/components"
import { LoginForm } from "@/features/auth/components"
import { useAuth } from "@/features/auth/context"

/**
 * Tela pública de autenticação do ERP.
 *
 * Após o fluxo OAuth2, a API redireciona de volta para cá com:
 * - ?token=<jwt>  → login OK: guarda o token e segue para /home
 * - ?error=<msg>  → falha: exibe o motivo exato como feedback
 */
export function LoginPage() {
  const navigate = useNavigate()
  const { entrar } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get("token")
    const err = searchParams.get("error")

    if (token) {
      entrar(token)
      navigate("/home", { replace: true })
      return
    }

    if (err) {
      setError(err)
      // Remove o parâmetro da URL para não reexibir ao recarregar.
      searchParams.delete("error")
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams, navigate, entrar])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <AppLogo size="sm" />
        <LoginForm error={error} />
      </div>
    </main>
  )
}
