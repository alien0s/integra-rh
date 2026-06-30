import { cn } from "@/lib/utils"

/**
 * Bloco de carregamento com efeito shimmer (varredura de brilho).
 * Use para placeholders de conteúdo vindo do back-end.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
    </div>
  )
}

export { Skeleton }
