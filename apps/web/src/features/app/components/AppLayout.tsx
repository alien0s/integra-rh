import type { ReactNode } from "react"

import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/features/app/components/AppSidebar"
import {
  AppHeader,
  type AppHeaderBreadcrumbItem,
} from "@/features/app/components/AppHeader"
import { useTabletSidebar } from "@/hooks/use-tablet-sidebar"

export interface AppLayoutProps {
  title: string
  description?: string
  actions?: ReactNode
  /**
   * Abas de navegação da página (ex.: Visão geral/Pessoal/Feriados em
   * /ferias) — ganham uma linha própria no cabeçalho, abaixo do título, em
   * vez de disputar espaço com busca/ações/sino na mesma linha.
   */
  tabs?: ReactNode
  breadcrumbs?: AppHeaderBreadcrumbItem[]
  children: ReactNode
  /**
   * Quando true, trava a área de conteúdo na altura da viewport (sidebar e
   * cabeçalho fixos) e quem rola é o próprio `<main>` — para telas com uma
   * lista/tabela grande que deve ter scroll interno em vez de esticar a
   * página inteira. Padrão false: comportamento de sempre (a página cresce
   * com o conteúdo e quem rola é o navegador) — não afeta as demais telas.
   */
  fillHeight?: boolean
}

const layoutFrameClass = "mx-auto w-full max-w-[1536px]"
const layoutSpacingClass = "px-6 sm:px-8 lg:px-10 2xl:px-12"

/**
 * Layout principal usado pelas telas autenticadas do ERP.
 */
export function AppLayout({
  title,
  description,
  actions,
  tabs,
  breadcrumbs,
  children,
  fillHeight = false,
}: AppLayoutProps) {
  const { open, setOpen } = useTabletSidebar()

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />
      <SidebarInset className={`min-w-0 ${fillHeight ? "h-svh overflow-hidden" : ""}`}>
        <AppHeader
          title={title}
          description={description}
          actions={actions}
          tabs={tabs}
          breadcrumbs={breadcrumbs}
          className={`${layoutFrameClass} ${layoutSpacingClass} ${fillHeight ? "shrink-0" : ""}`}
        />
        <main
          className={`${layoutFrameClass} ${layoutSpacingClass} flex min-w-0 flex-1 flex-col py-6 lg:py-8 ${
            fillHeight ? "min-h-0 overflow-hidden" : ""
          }`}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
