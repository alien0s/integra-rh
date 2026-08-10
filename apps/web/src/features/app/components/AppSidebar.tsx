import type { ComponentProps } from "react"
import {
  BookOpen,
  Bot,
  ClipboardList,
  Fingerprint,
  GraduationCap,
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

const sidebarData = {
  navMain: [
    {
      title: "Dashboard",
      url: "/home",
      icon: Home,
    },
    {
      title: "Usuários",
      url: "/usuarios",
      icon: UsersRound,
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
      title: "Folha",
      url: "#",
      icon: ClipboardList,
    },
    {
      title: "Documentos",
      url: "#",
      icon: BookOpen,
    },
    {
      title: "Automações",
      url: "#",
      icon: Bot,
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
    },
  ],
}

/**
 * Navegação lateral principal do ERP.
 */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { open } = useSidebar()

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
        <NavMain items={sidebarData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
