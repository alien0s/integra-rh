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
  breadcrumbs?: AppHeaderBreadcrumbItem[]
  children: ReactNode
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
  breadcrumbs,
  children,
}: AppLayoutProps) {
  const { open, setOpen } = useTabletSidebar()

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <AppSidebar />
      <SidebarInset>
        <AppHeader
          title={title}
          description={description}
          actions={actions}
          breadcrumbs={breadcrumbs}
          className={`${layoutFrameClass} ${layoutSpacingClass}`}
        />
        <main
          className={`${layoutFrameClass} ${layoutSpacingClass} flex flex-1 flex-col py-6 lg:py-8`}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
