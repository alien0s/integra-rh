import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import type { LucideIcon } from "lucide-react"
import {
  Fingerprint,
  GraduationCap,
  Home,
  Palmtree,
  Settings,
  UsersRound,
} from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface PaginaItem {
  label: string
  path: string
  icon: LucideIcon
}

// Páginas navegáveis. Para adicionar subitens depois, basta criar novos
// CommandGroup (ex.: "Usuários" com atalhos internos da página).
const paginas: PaginaItem[] = [
  { label: "Anúncios", path: "/home", icon: Home },
  { label: "Usuários", path: "/usuarios", icon: UsersRound },
  { label: "Cursos e qualificações", path: "/cursos", icon: GraduationCap },
  { label: "Férias", path: "/ferias", icon: Palmtree },
  { label: "Pontos", path: "/ponto", icon: Fingerprint },
  { label: "Configurações", path: "/configuracoes", icon: Settings },
]

/**
 * Paleta de comandos (estilo Cmd+K do shadcn docs). Painel flutuante — NÃO é
 * modal: o fundo continua visível e scrollável (sem overlay escuro).
 * Fecha com Esc, clique fora ou ao selecionar um item. Abre com Cmd/Ctrl+K.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)

  // Atalho Cmd/Ctrl+K (abre/fecha) e Esc (fecha).
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        onOpenChange(!open)
      }
      if (event.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  // Fecha ao clicar fora do painel (sem overlay, o fundo segue interativo).
  useEffect(() => {
    if (!open) return
    function onClick(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onOpenChange(false)
      }
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open, onOpenChange])

  if (!open) return null

  function irPara(path: string) {
    navigate(path)
    onOpenChange(false)
  }

  return (
    <div className="fixed left-1/2 top-24 z-50 w-[92%] max-w-lg -translate-x-1/2">
      <div
        ref={panelRef}
        className="overflow-hidden rounded-xl border bg-popover shadow-2xl"
      >
        <Command>
          <CommandInput placeholder="Buscar página…" autoFocus />
          <CommandList>
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
            <CommandGroup heading="Páginas">
              {paginas.map((pagina) => {
                const Icon = pagina.icon
                return (
                  <CommandItem
                    key={pagina.path}
                    value={pagina.label}
                    onSelect={() => irPara(pagina.path)}
                  >
                    <Icon className="h-4 w-4" />
                    {pagina.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </div>
  )
}
