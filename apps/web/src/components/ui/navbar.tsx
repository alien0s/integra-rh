import { Menu } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/cn"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"

export interface NavbarItem {
  label: string
  href: string
  active?: boolean
}

export interface NavbarProps extends React.HTMLAttributes<HTMLElement> {
  brand: React.ReactNode
  items?: NavbarItem[]
  actions?: React.ReactNode
}

function Navbar({ brand, items = [], actions, className, ...props }: NavbarProps) {
  return (
    <header
      className={cn("border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}
      {...props}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="truncate text-sm font-semibold">{brand}</div>
          {items.length > 0 ? (
            <nav className="hidden items-center gap-1 md:flex">
              {items.map((item) => (
                <Button
                  asChild
                  className={cn(item.active && "bg-accent text-accent-foreground")}
                  key={item.href}
                  size="sm"
                  variant="ghost"
                >
                  <a href={item.href}>{item.label}</a>
                </Button>
              ))}
            </nav>
          ) : null}
        </div>

        <div className="hidden items-center gap-2 md:flex">{actions}</div>

        {items.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="md:hidden" size="icon" variant="ghost">
                <Menu className="h-4 w-4" />
                <span className="sr-only">Abrir menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {items.map((item) => (
                <DropdownMenuItem asChild key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </header>
  )
}

export { Navbar }
