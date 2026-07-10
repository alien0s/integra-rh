import { Fragment, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Bell, Search } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { CommandPalette } from "@/features/app/components/CommandPalette"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export interface AppHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  className?: string
  breadcrumbs?: AppHeaderBreadcrumbItem[]
}

export interface AppHeaderBreadcrumbItem {
  label: string
  href?: string
}

const notifications = [
  {
    id: "1",
    name: "Marcos",
    action: "aprovou seu certificado de nível superior",
    detail: "Administração de Empresas",
    time: "2 min",
    avatar: "https://i.pravatar.cc/96?img=13",
    initials: "MA",
    unread: true,
  },
  {
    id: "2",
    name: "Juliana",
    action: "comentou na sua solicitação de validação",
    detail: "MBA em Gestão de Pessoas",
    time: "18 min",
    avatar: "https://i.pravatar.cc/96?img=45",
    initials: "JU",
    unread: true,
  },
  {
    id: "3",
    name: "Renata",
    action: "enviou uma pendência para revisão",
    detail: "Histórico acadêmico",
    time: "1 h",
    avatar: "https://i.pravatar.cc/96?img=29",
    initials: "RE",
    unread: true,
  },
  {
    id: "4",
    name: "Carlos",
    action: "validou sua declaração de curso",
    detail: "Excel avançado para dashboards",
    time: "Ontem",
    avatar: "https://i.pravatar.cc/96?img=60",
    initials: "CA",
    unread: false,
  },
]

export function AppHeader({
  title,
  actions,
  className,
  breadcrumbs,
}: AppHeaderProps) {
  const { open } = useSidebar()
  const [buscaAberta, setBuscaAberta] = useState(false)
  const unreadCount = notifications.filter(
    (notification) => notification.unread
  ).length

  return (
    <>
    <header className="sticky top-0 z-10 border-b bg-card">
      <div
        className={`flex min-h-16 flex-col items-start justify-center gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:py-0 ${className}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Tooltip className="md:hidden -ml-2">
            <TooltipTrigger asChild>
              <SidebarTrigger />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {open ? "Fechar menu" : "Abrir menu"}
            </TooltipContent>
          </Tooltip>
          <div className="min-w-0">
            {breadcrumbs?.length ? (
              <Breadcrumb>
                <BreadcrumbList className="flex-nowrap text-sm">
                  {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1

                    return (
                      <Fragment key={`${item.label}-${index}`}>
                        <BreadcrumbItem>
                          {isLast ? (
                            <h1
                              className="truncate text-sm font-semibold text-foreground"
                              aria-current="page"
                            >
                              {item.label}
                            </h1>
                          ) : item.href ? (
                            <BreadcrumbLink asChild>
                              <Link to={item.href}>{item.label}</Link>
                            </BreadcrumbLink>
                          ) : (
                            <span>{item.label}</span>
                          )}
                        </BreadcrumbItem>
                        {!isLast ? <BreadcrumbSeparator /> : null}
                      </Fragment>
                    )
                  })}
                </BreadcrumbList>
              </Breadcrumb>
            ) : (
              <h1 className="truncate text-sm font-semibold">{title}</h1>
            )}
          </div>
        </div>

        <div className="flex w-full shrink-0 items-center justify-end gap-4 overflow-x-auto sm:overflow-visible sm:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Pesquisar"
              readOnly
              onClick={() => setBuscaAberta(true)}
              onFocus={() => setBuscaAberta(true)}
              className="h-8 cursor-pointer bg-background pl-8 shadow-none"
            />
          </div>
          {actions ? actions : null}
          <div className="flex items-center gap-4">
            {/* Pipe sempre presente no header (separa busca/ações das notificações). */}
            <Separator orientation="vertical" className="h-6" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-8 w-8 text-muted-foreground"
                  aria-label="Notificações"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-card" />
                  ) : null}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-[360px] p-0"
              >
                <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-semibold">Notificações</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {unreadCount} novas
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                <div className="max-h-[360px] overflow-y-auto p-1">
                  {notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="items-start gap-3 rounded-md p-3"
                    >
                      <Avatar className="h-10 w-10 rounded-lg">
                        <AvatarImage
                          src={notification.avatar}
                          alt={notification.name}
                        />
                        <AvatarFallback className="rounded-lg text-xs font-semibold">
                          {notification.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm leading-snug text-foreground">
                          <span className="font-semibold">
                            {notification.name}
                          </span>{" "}
                          {notification.action}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {notification.detail}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className="text-xs text-muted-foreground">
                          {notification.time}
                        </span>
                        {notification.unread ? (
                          <span className="h-2 w-2 rounded-full bg-blue-600" />
                        ) : null}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>

      <CommandPalette open={buscaAberta} onOpenChange={setBuscaAberta} />
    </>
  )
}
