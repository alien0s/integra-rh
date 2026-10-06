import { Fragment, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Search } from "lucide-react"

import { Button } from "@/components/ui/button"
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
  /**
   * Abas de navegação da página (ex.: Visão geral/Pessoal/Feriados em
   * /ferias). No desktop (sm+) ficam INLINE com busca/ações/sino, igual
   * sempre foi — só no mobile (<sm) ganham uma linha própria abaixo, porque
   * aí não cabe tudo numa linha só (ver o bloco "só mobile" no fim do
   * header).
   */
  tabs?: ReactNode
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
  tabs,
  className,
  breadcrumbs,
}: AppHeaderProps) {
  const { open } = useSidebar()
  const [buscaAberta, setBuscaAberta] = useState(false)

  return (
    <>
    <header className="sticky top-0 z-10 border-b bg-card">
      <div className={`flex min-h-16 items-center justify-between gap-3 py-3 ${className}`}>
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

        <div className="flex shrink-0 items-center justify-end gap-4">
          {/* Busca: input completo só no desktop (lg+); ícone no mobile E no
              tablet, porque o input não cabe mais na mesma linha junto com
              as abas/sino sem forçar scroll nessas larguras. */}
          <div className="relative hidden lg:block lg:w-56">
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
          <Tooltip className="lg:hidden">
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Pesquisar"
                onClick={() => setBuscaAberta(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Pesquisar</TooltipContent>
          </Tooltip>

          {/* Abas: só no desktop (lg+) ficam INLINE aqui (display:contents —
              o wrapper não gera caixa própria, os filhos entram direto nesta
              linha, igual sempre foi). No mobile/tablet ficam escondidas
              aqui; aparecem só na linha própria no fim do header. */}
          {tabs ? <div className="hidden lg:contents">{tabs}</div> : null}

          {actions ? actions : null}
          <div className="flex items-center gap-4">
            {/* Pipe sempre presente no header (separa busca/ações das notificações). */}
            <Separator orientation="vertical" className="h-6" />
            <NotificacoesDrawer />
          </div>
        </div>
      </div>

      {/* Só mobile/tablet (<lg): abas numa linha própria, cheia — no desktop
          (lg+) elas já aparecem inline acima (display:contents), então este
          bloco fica escondido. overflow-y-hidden trava o scroll vertical que
          o overflow-x-auto força (CSS pareia visible→auto nos dois eixos). */}
      {tabs ? (
        <div className="scrollbar-thin w-full overflow-x-auto overflow-y-hidden px-4 py-2 lg:hidden">
          {tabs}
        </div>
      ) : null}
    </header>

      <CommandPalette open={buscaAberta} onOpenChange={setBuscaAberta} />
    </>
  )
}
