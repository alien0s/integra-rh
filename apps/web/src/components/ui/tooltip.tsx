import * as React from "react"
import { cn } from "@/lib/utils"

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function Tooltip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("group/tooltip relative inline-flex", className)}>{children}</div>
}

export function TooltipTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) {
  return <>{children}</>
}

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left"
}

export function TooltipContent({ children, className, side = "top", ...props }: TooltipContentProps) {
  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute z-50 flex items-center justify-center rounded-md bg-black px-3 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover/tooltip:opacity-100 whitespace-nowrap dark:bg-white dark:text-black",
        sideClasses[side],
        className
      )}
      {...props}
    >
      {children}
      <div className={cn(
        "absolute size-2 bg-black rotate-45 dark:bg-white",
        side === "top" ? "bottom-[-4px] left-1/2 -translate-x-1/2" : "",
        side === "bottom" ? "top-[-4px] left-1/2 -translate-x-1/2" : "",
        side === "left" ? "right-[-4px] top-1/2 -translate-y-1/2" : "",
        side === "right" ? "left-[-4px] top-1/2 -translate-y-1/2" : "",
      )} />
    </div>
  )
}
