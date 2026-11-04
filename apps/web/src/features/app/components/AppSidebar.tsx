import type { ComponentProps } from "react"
import {
  Bug,
  Fingerprint,
  Megaphone,
  GraduationCap,
  Hamburger,
  Palmtree,
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
import { NavMain, type NavMainItem } from "@/features/app/components/NavMain"
import { NavUser } from "@/features/app/components/NavUser"
import { useAuth } from "@/features/auth/context"
import { moduloLiberado, moduloLiberadoNoBeta } from "@/features/auth/lib/modulos"

const sidebarData = {
  navMain: [
    {
      title: "Anúncios",
      url: "/home",
      icon: Megaphone,
      moduloCodigo: "home",
    },
    {
      title: "Usuários",
      url: "/usuarios",
      icon: UsersRound,
      moduloCodigo: "usuarios",
    },
    {
      title: "Cursos e qualificações",
      url: "/cursos",
      icon: GraduationCap,
      moduloCodigo: "cursos",
    },
    {
      title: "Férias",
      url: "/ferias",
      icon: Palmtree,
      moduloCodigo: "ferias",
    },
    {
      title: "Pontos",
      url: "/ponto",
      icon: Fingerprint,
      moduloCodigo: "ponto",
    },
    {
      title: "Tabelas",
      url: "/tabelas",
      icon: Table2,
      moduloCodigo: "tabelas",
    },
    {
      title: "VR",
      url: "/vr",
      icon: Hamburger,
      moduloCodigo: "vr",
    },
  ],
}

/**
 * Catálogo dos itens do sidebar — reaproveitado pela tela admin
 * "Visibilidade de módulos" (ModulosVisibilidadeAdmin.tsx) como a lista de
 * linhas da matriz (módulo × papel). O catálogo de módulos em si (título,
 * url, ícone) continua definido aqui, em código — só a visibilidade por
 * papel é configurável (modulosRestritos, via modulos_visibilidade).
 */
export const MODULOS_SIDEBAR = sidebarData.navMain

/**
 * Navegação lateral principal do ERP.
 */
export function AppSidebar(props: ComponentProps<typeof Sidebar>) {
  const { open } = useSidebar()
  const { usuario } = useAuth()

  const navMain: NavMainItem[] = sidebarData.navMain
    .filter((item) => moduloLiberado(usuario, item.moduloCodigo))
    .map((item) => ({
      ...item,
      locked: !moduloLiberadoNoBeta(usuario, item.moduloCodigo),
    }))

  // Logs (diagnóstico de erros inesperados do backend) não é um módulo de
  // negócio configurável por papel — não entra em MODULOS_SIDEBAR nem na
  // matriz "Visibilidade de módulos" (tela Tabelas). É uma ferramenta
  // interna, visível só para ADMIN, mesma regra hardcoded de /configuracoes
  // (RequireLancamentoBeta, ver App.tsx).
  if (usuario?.papelCodigo === "ADMIN") {
    navMain.push({ title: "Logs", url: "/logs", icon: Bug, locked: false })
  }

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
