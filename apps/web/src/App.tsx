import { Navigate, Route, Routes } from "react-router-dom"

import { Toaster as SonnerToaster } from "sonner"

import { Toaster } from "@/components/ui/toaster"
import { useTheme } from "@/components/theme-provider"
import {
  LoginPage,
  RequireAuth,
  RequireNaoColaborador,
  RequireAdmin,
  RequireVr,
  RequireLancamentoBeta,
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
import { DetalheQualificacaoDialog } from "@/features/cursos/components"
import { VisualizadorArquivoDialog } from "@/features/visualizador-arquivo"

/**
 * Papéis liberados em /cursos durante o lançamento beta, além de ADMIN — RH
 * já modera (aprovar/recusar) cursos/formações/idiomas nessa tela fora do
 * beta (ver PAPEIS_RH em apps/api/src/routes/qualificacoes.routes.ts e o
 * cadeado equivalente em AppSidebar.tsx — mantenha os três em sincronia).
 */
const PAPEIS_LIBERADOS_CURSOS_BETA = new Set(["RH"])

/**
 * Rotas principais da aplicação web.
 * /login é pública; todo o resto exige sessão (RequireAuth).
 */
export function App() {
  const { resolvedTheme } = useTheme()

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
          {/* Liberada a todo mundo (inclusive COLABORADOR) — sempre o próprio
              usuário logado, nunca outra pessoa. Também é o destino do
              redirect do lançamento beta (RequireLancamentoBeta) — por isso
              fica FORA desse guard, nunca pode virar uma rota bloqueada. */}
          <Route path="/meu-perfil" element={<MeuPerfil />} />

          {/* Lançamento pra algumas pessoas (por enquanto): só ADMIN entra
              nas rotas abaixo — ver RequireLancamentoBeta (fácil de tirar
              depois: um único flag lá e no cadeado do AppSidebar.tsx). */}
          <Route element={<RequireLancamentoBeta />}>
            <Route path="/home" element={<HomePage />} />
            <Route path="/ferias" element={<FeriasPage />} />
            <Route path="/ponto" element={<PontoPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />

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

          {/* Cursos e Qualificações também libera RH durante o beta — já
              modera (aprovar/recusar) cursos/formações/idiomas nessa tela
              fora do beta, então fica de fora do bloqueio geral acima (ver
              exigirAdminOuPapeisDuranteBeta no backend, mesma ideia). */}
          <Route element={<RequireLancamentoBeta papeisExtras={PAPEIS_LIBERADOS_CURSOS_BETA} />}>
            <Route path="/cursos" element={<CursosPage />} />
          </Route>

          {/* Só DP (ou os IDs liberados) acessa VR, mesmo digitando a URL
              direto — controle próprio, fora do lançamento beta acima. */}
          <Route element={<RequireVr />}>
            <Route path="/vr" element={<VrPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to={LANDING_ROUTE} replace />} />
        <Route path="*" element={<Navigate to={LANDING_ROUTE} replace />} />
      </Routes>
      <Toaster />
      {/* Visualizador universal de arquivo (imagem/PDF) — montado uma vez
          aqui; qualquer módulo abre chamando abrirArquivo(), sem precisar de
          contexto/provider (ver features/visualizador-arquivo). */}
      <VisualizadorArquivoDialog />
      {/* Detalhe de uma qualificação (formação/curso/idioma), aberto ao
          clicar numa notificação — montado uma vez aqui (não na página de
          origem) pra sobreviver à navegação pra /cursos que acontece junto
          (ver features/cursos/lib/detalheQualificacaoStore). */}
      <DetalheQualificacaoDialog />
      {/* Sonner: cards de notificação acionável (aprovar/recusar) que aparecem
          ao logar e em tempo quase real. Os cards acionáveis usam `unstyled`
          POR TOAST (controlam a própria aparência); os toasts informativos usam
          o estilo padrão do Sonner — por isso `theme` precisa acompanhar o
          tema do app (Sistema/Dia/Noite), senão ficam sempre claros mesmo no
          escuro. `font-sans` mantém a fonte Geist do app. */}
      <SonnerToaster
        position="bottom-right"
        theme={resolvedTheme}
        toastOptions={{ className: 'font-sans' }}
        richColors={false}
      />
    </>
  )
}
