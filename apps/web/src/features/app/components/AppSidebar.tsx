import type { ComponentProps } from "react"
import {
  Fingerprint,
  Megaphone,
  GraduationCap,
  Hamburger,
  Home,
  Palmtree,
  Settings,
  Table2,
  UsersRound,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AppLogo } from "@/features/app/components/AppLogo"
import { NavMain } from "@/features/app/components/NavMain"
import { NavUser } from "@/features/app/components/NavUser"
import { useAuth } from "@/features/auth/context"

/**
 * Papéis liberados pro VR (por `codigo`, catálogo `roles`) além de ADMIN: DP,
 * COORDENADOR DP, ASSISTENTE (Tesoureiro Assistente, nível 4) e TESOUREIRO
 * (nível 5). Mesmo conjunto em AuthGuards.tsx (RequireVr) e no back
 * (PAPEIS_LIBERADOS_VR em vr.routes.ts, com o mapeamento código → id de cada
 * papel documentado lá) — sem módulo compartilhado entre os deployables,
 * mantenha as três listas em sincronia. Ver também docs/vr.md.
 */
const PAPEIS_LIBERADOS_VR = new Set(["DP", "COORDENADOR DP", "ASSISTENTE", "TESOUREIRO"])

/**
 * Papéis liberados em "Cursos e qualificações" durante o beta, além de
 * ADMIN — RH já modera (aprovar/recusar) cursos/formações/idiomas nessa tela
 * fora do beta. Mesmo conjunto em App.tsx (PAPEIS_LIBERADOS_CURSOS_BETA) e
 * no backend (PAPEIS_RH em qualificacoes.routes.ts) — mantenha os três em
 * sincronia.
 */
const PAPEIS_LIBERADOS_CURSOS_BETA = new Set(["RH"])

/**
 * Lançamento pra algumas pessoas (por enquanto): todo item da sidebar fica
 * com cadeado (não navega) pra quem não é ADMIN — EXCETO VR, que já tem seu
 * próprio controle de acesso (podeVerVr), e Cursos e qualificações pra quem
 * está em PAPEIS_LIBERADOS_CURSOS_BETA. ADMIN sempre vê tudo liberado. Isso é
 * só uma camada temporária por cima das regras de visibilidade de sempre
 * (somenteNaoColaborador/somenteAdmin/somenteVr, que continuam decidindo
 * quem VÊ cada item) — desative aqui quando lançar geral.
 */
const LANCAMENTO_BETA_ATIVO = true

const sidebarData = {
  navMain: [
    {
      title: "Anúncios",
      url: "/home",
      icon: Megaphone,
    },
    {
      title: "Usuários",
      url: "/usuarios",
      icon: UsersRound,
      // COLABORADOR só vê os próprios dados — sem acesso à tela de Usuários
      // (nem a sidebar mostra, nem a rota deixa entrar por URL direta — ver
      // RequireNaoColaborador em App.tsx e bloquearColaborador na API).
      somenteNaoColaborador: true,
    },
    {
      title: "Cursos e qualificações",
      url: "/cursos",
      icon: GraduationCap,
      // RH já modera cursos/formações/idiomas aqui — não fica com cadeado
      // durante o beta (ver PAPEIS_LIBERADOS_CURSOS_BETA acima).
      papeisLiberadosBeta: PAPEIS_LIBERADOS_CURSOS_BETA,
    },
    {
      title: "Férias",
      url: "/ferias",
      icon: Palmtree,
    },
    {
      title: "Pontos",
      url: "/ponto",
      icon: Fingerprint,
    },
    {
      title: "Configurações",
      url: "/configuracoes",
      icon: Settings,
    },
    {
      title: "Tabelas",
      url: "/tabelas",
      icon: Table2,
      // Só ADMIN (nível 7) vê este item — ver RequireAdmin em App.tsx e
      // exigirPapeis() (sem argumentos = só ADMIN) na API.
      somenteAdmin: true,
    },
    {
      title: "VR",
      url: "/vr",
      icon: Hamburger,
      // Só DP (ou os IDs liberados) vê este item — ver RequireVr em App.tsx e
      // exigirAcessoVr na API (vr.routes.ts).
      somenteVr: true,
    },
  ],
}

/**
 * Navegação lateral principal do ERP.
 */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { open } = useSidebar()
  const { usuario } = useAuth()
  const ehColaborador = usuario?.papelCodigo === "COLABORADOR"
  const ehAdmin = usuario?.papelCodigo === "ADMIN"
  const podeVerVr =
    ehAdmin ||
    (usuario?.papelCodigo !== undefined && PAPEIS_LIBERADOS_VR.has(usuario.papelCodigo))

  const navMain = sidebarData.navMain
    .filter(
      (item) =>
        !(item.somenteNaoColaborador && ehColaborador) &&
        !(item.somenteAdmin && !ehAdmin) &&
        !(item.somenteVr && !podeVerVr),
    )
    .map((item) => ({
      ...item,
      locked:
        LANCAMENTO_BETA_ATIVO &&
        !ehAdmin &&
        !item.somenteVr &&
        !(usuario?.papelCodigo !== undefined && item.papeisLiberadosBeta?.has(usuario.papelCodigo)),
    }))

  return (
    <Sidebar
      collapsible="icon"
      className="[--sidebar-foreground:var(--color-neutral-600)] dark:[--sidebar-foreground:var(--color-foreground)]"
      {...props}
    >
      <SidebarHeader>
        <div className="group/sidebar-logo relative flex items-center">
          <AppLogo className="[&_[data-slot=app-logo-label]]:font-bold [&_[data-slot=app-logo-label]]:text-neutral-700 dark:[&_[data-slot=app-logo-label]]:text-neutral-200 [&_[data-slot=app-logo-icon]]:transition-opacity [&_[data-slot=app-logo-icon]]:duration-200 group-hover/sidebar-logo:[&_[data-slot=app-logo-icon]]:opacity-0" />
          <Tooltip className="absolute left-0 top-1/2 size-8 -translate-y-1/2 opacity-0 transition-opacity duration-200 group-hover/sidebar-logo:opacity-100">
            <TooltipTrigger asChild>
              <SidebarTrigger className="h-full w-full [&_svg]:size-5" />
            </TooltipTrigger>
            <TooltipContent side="right">
              {open ? "Fechar menu" : "Abrir menu"}
            </TooltipContent>
          </Tooltip>
        </div>
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]/sidebar:overflow-visible">
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
