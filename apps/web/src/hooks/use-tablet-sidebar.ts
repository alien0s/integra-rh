import { useState, useEffect } from "react"

export function useTabletSidebar() {
  // Inicializa o estado com base na largura da tela:
  // Se for >= 1024px (desktop), inicia aberto (true)
  // Se for < 1024px (tablet/mobile), inicia fechado (false)
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return true
    return window.matchMedia("(min-width: 1024px)").matches
  })

  useEffect(() => {
    const tabletQuery = window.matchMedia("(max-width: 1023px)")

    const handleTabletChange = (event: MediaQueryListEvent) => {
      // Se a tela passou a ser <= 1023px (event.matches = true), fecha o sidebar
      // Se a tela passou a ser >= 1024px (event.matches = false), abre o sidebar
      setOpen(!event.matches)
    }

    tabletQuery.addEventListener("change", handleTabletChange)

    return () => {
      tabletQuery.removeEventListener("change", handleTabletChange)
    }
  }, [])

  return { open, setOpen }
}
