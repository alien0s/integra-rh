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

  const navMain = sidebarData.navMain.filter(
    (item) =>
      !(item.somenteNaoColaborador && ehColaborador) &&
      !(item.somenteAdmin && !ehAdmin),
  )

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
