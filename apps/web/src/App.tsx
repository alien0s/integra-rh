import { Navigate, Route, Routes } from "react-router-dom"

import { Toaster as SonnerToaster } from "sonner"

import { Toaster } from "@/components/ui/toaster"
import {
  LoginPage,
  RequireAuth,
  RequireNaoColaborador,
  RequireAdmin,
  RedirectSeLogado,
} from "@/features/auth"
import { CursosPage } from "@/features/cursos"
import { FeriasPage } from "@/features/ferias"
import { PontoPage } from "@/features/ponto"
import { ConfiguracoesPage } from "@/features/configuracoes"
import { TabelasPage } from "@/features/tabelas"
import { UsuariosPage } from "@/features/usuarios"
import { LANDING_ROUTE } from "@/lib/auth"
import { HomePage } from "@/features/home"
import { MeuPerfil } from "@/pages/usuarios/MeuPerfil"
import { UsuarioPerfil } from "@/pages/usuarios/UsuarioPerfil"
import { VrPage } from "@/features/vr"

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
          <Route path="/vr" element={<VrPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          {/* Liberada a todo mundo (inclusive COLABORADOR) — sempre o próprio
              usuário logado, nunca outra pessoa. */}
          <Route path="/meu-perfil" element={<MeuPerfil />} />

          {/* COLABORADOR não acessa Usuários nem digitando a URL direto. */}
          <Route element={<RequireNaoColaborador />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/usuarios/:usuarioId" element={<UsuarioPerfil />} />
          </Route>

          {/* Só ADMIN (nível 7) acessa Tabelas, mesmo digitando a URL direto. */}
          <Route element={<RequireAdmin />}>
            <Route path="/tabelas" element={<TabelasPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={LANDING_ROUTE} replace />} />
        <Route path="*" element={<Navigate to={LANDING_ROUTE} replace />} />
      </Routes>
      <Toaster />
      {/* Sonner: cards de notificação acionável (aprovar/recusar) que aparecem
          ao logar e em tempo quase real. Os cards acionáveis usam `unstyled`
          POR TOAST (controlam a própria aparência); os toasts informativos usam
          o estilo padrão do Sonner. `font-sans` mantém a fonte Geist do app. */}
      <SonnerToaster
        position="bottom-right"
        toastOptions={{ className: 'font-sans' }}
        richColors={false}
      />
    </>
  )
}
