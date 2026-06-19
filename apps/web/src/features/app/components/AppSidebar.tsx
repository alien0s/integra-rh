import type { ComponentProps } from "react"
import {
  BookOpen,
  Bot,
  Building2,
  CalendarClock,
  ClipboardList,
  Frame,
  GraduationCap,
  Home,
  Map,
  MoreHorizontal,
  PieChart,
  Settings,
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
  user: {
    name: "Administrador",
    email: "admin@aceam.org.br",
    avatar:
      "https://64.media.tumblr.com/4cd75c356eab6a8766db28cdd0cb1831/4bda282c1c1300a9-a7/s400x600/eaeee415806ccc605406310d6a111126d714a2d2.jpg",
  },
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
      url: "#",
      icon: Settings,
    },
    {
      title: "Admissões",
      url: "#",
      icon: Frame,
    },
    {
      title: "Relatórios RH",
      url: "#",
      icon: PieChart,
    },
    {
      title: "Escalas",
      url: "#",
      icon: CalendarClock,
    },
    {
      title: "Unidades",
      url: "#",
      icon: Map,
    },
    {
      title: "Centro de custos",
      url: "#",
      icon: Building2,
    },
    {
      title: "Mais",
      url: "#",
      icon: MoreHorizontal,
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
          <AppLogo className="[&_[data-slot=app-logo-icon]]:transition-opacity [&_[data-slot=app-logo-icon]]:duration-200 group-hover/sidebar-logo:[&_[data-slot=app-logo-icon]]:opacity-0" />
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
      <SidebarContent>
        <NavMain items={sidebarData.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
