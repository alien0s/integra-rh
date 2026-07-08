import type { ComponentProps } from "react"
import { Leaf } from "lucide-react"

import { cn } from "@/lib/utils"

type AppLogoSize = "sm" | "md"

export interface AppLogoProps extends ComponentProps<"div"> {
  size?: AppLogoSize
}

const logoSizeClasses: Record<AppLogoSize, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
}

const iconSizeClasses: Record<AppLogoSize, string> = {
  sm: "h-4 w-4",
  md: "h-4 w-4",
}

/**
 * Marca visual principal da aplicação.
 */
export function AppLogo({ className, size = "md", ...props }: AppLogoProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-semibold text-brand dark:text-white",
        className
      )}
      {...props}
    >
      <span
        data-slot="app-logo-icon"
        className={cn(
          "flex items-center justify-center rounded-md bg-blue-600 text-white",
          logoSizeClasses[size]
        )}
      >
        <Leaf className={iconSizeClasses[size]} />
      </span>
      <span
        data-slot="app-logo-label"
        className="truncate group-data-[state=collapsed]/sidebar:hidden"
      >
        IntegraRH
      </span>
    </div>
  )
}
