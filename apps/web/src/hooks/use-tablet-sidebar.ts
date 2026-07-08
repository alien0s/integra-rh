import { useEffect, useState } from "react"

const STORAGE_KEY = "sidebar_open"

/**
 * Lê o estado inicial do sidebar:
 * - Se há preferência salva (localStorage), respeita-a — sobrevive à navegação
 *   (o AppLayout remonta a cada rota, então sem isso o sidebar reabriria sozinho).
 * - Sem preferência salva: decide pela largura (desktop aberto, tablet/mobile fechado).
 */
function lerEstadoInicial(): boolean {
  if (typeof window === "undefined") return true

  const salvo = window.localStorage.getItem(STORAGE_KEY)
  if (salvo === "true") return true
  if (salvo === "false") return false

  return window.matchMedia("(min-width: 1024px)").matches
}

export function useTabletSidebar() {
  const [open, setOpenState] = useState<boolean>(lerEstadoInicial)

  /** Atualiza o estado e persiste a preferência do usuário. */
  function setOpen(value: boolean) {
    setOpenState(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // Ignora ambientes sem localStorage.
    }
  }

  useEffect(() => {
    const tabletQuery = window.matchMedia("(max-width: 1023px)")

    // Ao entrar em tela pequena, recolhe automaticamente.
    // Não força abrir no desktop — respeita a escolha do usuário (só a logo abre).
    const handleTabletChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false)
    }

    tabletQuery.addEventListener("change", handleTabletChange)
    return () => tabletQuery.removeEventListener("change", handleTabletChange)
  }, [])

  return { open, setOpen }
}
