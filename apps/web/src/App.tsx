import { Navigate, Route, Routes } from "react-router-dom"

import { Toaster as SonnerToaster } from "sonner"

import { Toaster } from "@/components/ui/toaster"
import { useTheme } from "@/components/theme-provider"
import {
  LoginPage,
  RequireAuth,
  RequireModulo,
  RequireLancamentoBeta,
  RedirectSeLogado,
} from "@/features/auth"
import { CursosPage } from "@/features/cursos"
import { FeriasPage } from "@/features/ferias"
import { LogsPage } from "@/features/logs"
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
              redirect de módulo oculto/bloqueado (RequireModulo) e do
              lançamento beta (RequireLancamentoBeta) — por isso fica FORA
              desses guards, nunca pode virar uma rota bloqueada. */}
          <Route path="/meu-perfil" element={<MeuPerfil />} />

          {/* Configurações não é um módulo do sidebar (sem moduloCodigo, não
              entra na matriz "Visibilidade de módulos") — continua só com o
              bloqueio geral do lançamento beta (ADMIN por enquanto). */}
          <Route element={<RequireLancamentoBeta />}>
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
          </Route>

          {/* Logs (diagnóstico de erros inesperados do backend) também não é
              módulo do sidebar — ferramenta interna, só ADMIN, mesma regra
              de /configuracoes acima. */}
          <Route element={<RequireLancamentoBeta />}>
            <Route path="/logs" element={<LogsPage />} />
          </Route>

          {/* Cada módulo do sidebar passa só por RequireModulo — já cobre
              visibilidade (configurável em /tabelas) E o cadeado do
              lançamento beta (liberação antecipada por papel, mesma tela). */}
          <Route element={<RequireModulo moduloCodigo="home" />}>
            <Route path="/home" element={<HomePage />} />
          </Route>

          <Route element={<RequireModulo moduloCodigo="ferias" />}>
            <Route path="/ferias" element={<FeriasPage />} />
          </Route>

          <Route element={<RequireModulo moduloCodigo="ponto" />}>
            <Route path="/ponto" element={<PontoPage />} />
          </Route>

          <Route element={<RequireModulo moduloCodigo="usuarios" />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/usuarios/:usuarioId" element={<UsuarioPerfil />} />
          </Route>

          <Route element={<RequireModulo moduloCodigo="tabelas" />}>
            <Route path="/tabelas" element={<TabelasPage />} />
          </Route>

          <Route element={<RequireModulo moduloCodigo="cursos" />}>
            <Route path="/cursos" element={<CursosPage />} />
          </Route>

          <Route element={<RequireModulo moduloCodigo="vr" />}>
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
