import { Link, useLocation } from "react-router-dom"
import { type LucideIcon } from "lucide-react"

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

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

  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const isActive = item.isActive ?? item.url === pathname

          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
                className="data-[active=true]:transition-none text-sidebar-foreground hover:text-sidebar-accent-foreground data-[active=true]:bg-neutral-200 dark:data-[active=true]:bg-neutral-800 data-[active=true]:text-black dark:data-[active=true]:text-white data-[active=true]:[&_svg]:text-black dark:data-[active=true]:[&_svg]:text-white [&_svg]:text-sidebar-foreground"

              >
                <Link to={item.url}>
                  {item.icon ? <item.icon /> : null}
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}
