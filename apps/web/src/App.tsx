import { Navigate, Route, Routes } from "react-router-dom"

import { Toaster } from "@/components/ui/toaster"
import { LoginPage, RequireAuth, RedirectSeLogado } from "@/features/auth"
import { CursosPage } from "@/features/cursos"
import { FeriasPage } from "@/features/ferias"
import { PontoPage } from "@/features/ponto"
import { ConfiguracoesPage } from "@/features/configuracoes"
import { UsuariosPage } from "@/features/usuarios"
import { LANDING_ROUTE } from "@/lib/auth"
import { HomePage } from "@/pages/home/HomePage"
import { UsuarioPerfil } from "@/pages/usuarios/UsuarioPerfil"

/**
 * Rotas principais da aplicação web.
 * /login é pública; todo o resto exige sessão (RequireAuth).
 */
export function App() {
  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectSeLogado>
              <LoginPage />
            </RedirectSeLogado>
          }
        />

        {/* Rotas protegidas */}
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/cursos" element={<CursosPage />} />
          <Route path="/ferias" element={<FeriasPage />} />
          <Route path="/ponto" element={<PontoPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/usuarios/:usuarioId" element={<UsuarioPerfil />} />
        </Route>

        <Route path="/" element={<Navigate to={LANDING_ROUTE} replace />} />
        <Route path="*" element={<Navigate to={LANDING_ROUTE} replace />} />
      </Routes>
      <Toaster />
    </>
  )
}
