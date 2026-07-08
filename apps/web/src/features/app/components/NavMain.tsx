import { Link, useLocation } from "react-router-dom"
import { type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface NavMainItem {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
}

export interface NavMainProps {
  items: NavMainItem[]
}

/**
 * Lista principal de navegação da sidebar.
 */
export function NavMain({ items }: NavMainProps) {
  const { pathname } = useLocation()
  const { open, isMobile } = useSidebar()
  // Tooltip só faz sentido quando a sidebar está recolhida (modo ícone) no desktop.
  const mostrarTooltip = !open && !isMobile

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const isActive =
            item.isActive ??
            (item.url !== "#" &&
              (pathname === item.url || pathname.startsWith(`${item.url}/`)))

          const botao = (
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className="data-[active=true]:transition-none text-sidebar-foreground hover:text-sidebar-accent-foreground data-[active=true]:bg-blue-600 data-[active=true]:hover:bg-blue-600 data-[active=true]:text-white data-[active=true]:hover:text-white data-[active=true]:[&_svg]:text-white [&_svg]:text-sidebar-foreground"
            >
              <Link to={item.url}>
                {item.icon ? <item.icon /> : null}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          )

          return (
            <SidebarMenuItem key={item.title}>
              {mostrarTooltip ? (
                <Tooltip className="block">
                  <TooltipTrigger>{botao}</TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              ) : (
                botao
              )}
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
