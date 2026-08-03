import { Fragment, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { CommandPalette } from "@/features/app/components/CommandPalette"
import { NotificacoesDrawer } from "@/features/notificacoes/components"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
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

export function AppHeader({
  title,
  actions,
  className,
  breadcrumbs,
}: AppHeaderProps) {
  const { open } = useSidebar()
  const [buscaAberta, setBuscaAberta] = useState(false)

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
            <NotificacoesDrawer />
          </div>
        </div>
      </div>
    </header>

      <CommandPalette open={buscaAberta} onOpenChange={setBuscaAberta} />
    </>
  )
}
