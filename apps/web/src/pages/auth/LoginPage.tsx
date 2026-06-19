import { useNavigate } from "react-router-dom"

import { AppLogo } from "@/features/app/components"
import { LoginForm } from "@/features/auth/components"

/**
 * Tela pública de autenticação do ERP.
 */
export function LoginPage() {
  const navigate = useNavigate()

  function handleLogin() {
    navigate("/home", { replace: true })
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <AppLogo size="sm" />
        <LoginForm onLogin={handleLogin} />
      </div>
    </main>
  )
}
