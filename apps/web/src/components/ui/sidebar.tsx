"use client"

import * as React from "react"
import { PanelLeft } from "lucide-react"
import { Slot } from "radix-ui"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_ICON = "3rem"

interface SidebarContextValue {
  open: boolean
  setOpen: React.Dispatch<React.SetStateAction<boolean>>
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextValue | null>(null)

function getDefaultOpen() {
  if (typeof window === "undefined") {
    return true
  }

  return window.matchMedia("(min-width: 768px)").matches
}

function getIsMobile() {
  if (typeof window === "undefined") {
    return false
  }

  return window.matchMedia("(max-width: 767px)").matches
}

function useSidebar() {
  const context = React.useContext(SidebarContext)

  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider.")
  }

  return context
}

export interface SidebarProviderProps extends React.ComponentProps<"div"> {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Provedor de estado para o shell lateral da aplicação.
 */
function SidebarProvider({
  defaultOpen,
  open: openProp,
  onOpenChange,
  className,
  style,
  children,
  ...props
}: SidebarProviderProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    () => defaultOpen ?? getDefaultOpen()
  )
  const [isMobile, setIsMobile] = React.useState(getIsMobile)
  const open = openProp ?? uncontrolledOpen

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)")

    setIsMobile(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }

    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  const setOpen = React.useCallback(
    (value: React.SetStateAction<boolean>) => {
      const nextOpen = typeof value === "function" ? value(open) : value

      if (onOpenChange) {
        onOpenChange(nextOpen)
        return
      }

      setUncontrolledOpen(nextOpen)
    },
    [onOpenChange, open]
  )

  const toggleSidebar = React.useCallback(() => {
    setOpen((currentOpen) => !currentOpen)
  }, [setOpen])

  const contextValue = React.useMemo<SidebarContextValue>(
    () => ({
      open,
      setOpen,
      isMobile,
      toggleSidebar,
    }),
    [isMobile, open, setOpen, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        data-slot="sidebar-wrapper"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH,
            "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/sidebar-wrapper flex min-h-svh w-full bg-background text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

export interface SidebarProps extends React.ComponentProps<"aside"> {
  collapsible?: "icon" | "none"
}

/**
 * Container lateral principal.
 */
function Sidebar({
  className,
  collapsible = "icon",
  children,
  ...props
}: SidebarProps) {
  const { open, isMobile, setOpen } = useSidebar()
  const isCollapsed = !open && collapsible === "icon"

  return (
    <>
      {/* Abaixo de md (768px) o sidebar flutua por cima do conteúdo (fixed,
          não empurra a tela) — esse fundo escurecido cobre o resto da tela
          enquanto está aberto; clicar nele fecha o menu, prática padrão
          pra overlay desse tipo. */}
      {isMobile && open ? (
        <div
          data-slot="sidebar-backdrop"
          className="fixed inset-0 z-30"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <aside
        data-slot="sidebar"
        data-state={open ? "expanded" : "collapsed"}
        data-collapsible={isCollapsed ? "icon" : ""}
        className={cn(
          "group/sidebar fixed inset-y-0 left-0 z-40 flex h-svh w-[var(--sidebar-width)] flex-col border-r bg-sidebar text-sidebar-foreground transition-[transform,width] duration-200 ease-linear md:sticky md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed && "md:w-[var(--sidebar-width-icon)]",
          className
        )}
        {...props}
      >
        {children}
      </aside>
    </>
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex h-16 items-center p-2", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex flex-col gap-2 border-t p-2", className)}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        "px-2 py-1 text-xs font-medium text-muted-foreground group-data-[state=collapsed]/sidebar:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      className={cn("w-full", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  )
}

export interface SidebarMenuButtonProps
  extends React.ComponentProps<"button"> {
  asChild?: boolean
  isActive?: boolean
  size?: "default" | "sm" | "lg"
  tooltip?: string
}

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  size = "default",
  tooltip,
  className,
  ...props
}: SidebarMenuButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="sidebar-menu-button"
      data-active={isActive}
      data-size={size}
      title={tooltip}
      className={cn(
        "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm font-medium outline-none transition-[background-color,color,width,height,padding] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary data-[active=true]:[&_svg]:text-primary group-data-[collapsible=icon]/sidebar:!size-8 group-data-[collapsible=icon]/sidebar:!p-2 [&>span:last-child]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
        size === "sm" && "h-7 text-xs",

        size === "default" && "h-9",
        size === "lg" && "h-12 group-data-[collapsible=icon]/sidebar:!p-0",
        className
      )}
      {...props}
    />
  )
}

export interface SidebarMenuActionProps
  extends React.ComponentProps<"button"> {
  asChild?: boolean
  showOnHover?: boolean
}

function SidebarMenuAction({
  asChild = false,
  showOnHover = false,
  className,
  ...props
}: SidebarMenuActionProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex size-6 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 peer-data-[size=sm]/menu-button:top-0.5 peer-data-[size=default]/menu-button:top-1.5 peer-data-[size=lg]/menu-button:top-2.5 group-data-[state=collapsed]/sidebar:hidden [&_svg]:size-4 [&_svg]:shrink-0",
        showOnHover &&
        "opacity-0 group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      className={cn(
        "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5 group-data-[state=collapsed]/sidebar:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      className={cn("relative", className)}
      {...props}
    />
  )
}

export interface SidebarMenuSubButtonProps
  extends React.ComponentProps<"a"> {
  asChild?: boolean
  isActive?: boolean
  size?: "sm" | "md"
}

function SidebarMenuSubButton({
  asChild = false,
  isActive = false,
  size = "md",
  className,
  ...props
}: SidebarMenuSubButtonProps) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-active={isActive}
      className={cn(
        "flex min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50 data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary data-[active=true]:[&_svg]:text-primary [&>span:last-child]:truncate [&_svg]:size-4 [&_svg]:shrink-0",
        size === "sm" && "h-7 text-xs",
        size === "md" && "h-8 text-sm",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn("flex min-h-svh flex-1 flex-col bg-background", className)}
      {...props}
    />
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("size-8", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft className="h-4 w-4" />
      <span className="sr-only">Alternar menu</span>
    </Button>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-slot="sidebar-rail"
      type="button"
      aria-label="Alternar menu"
      className={cn(
        "absolute inset-y-0 right-[-0.5rem] hidden w-2 transition-colors hover:bg-sidebar-border md:block",
        className
      )}
      onClick={toggleSidebar}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
}
