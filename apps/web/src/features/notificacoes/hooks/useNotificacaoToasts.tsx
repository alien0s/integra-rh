import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { NotificacaoActionToast } from '@/features/notificacoes/components/NotificacaoActionToast'
import type { Notificacao } from '@/features/notificacoes/types'

/** Chave no sessionStorage com os ids já exibidos como toast nesta sessão de aba. */
const SESSION_KEY = 'notif_toasts_mostrados'

function carregarIdsMostrados(): Set<string> {
  try {
    const bruto = sessionStorage.getItem(SESSION_KEY)
    return new Set(bruto ? (JSON.parse(bruto) as string[]) : [])
  } catch {
    return new Set()
  }
}

function salvarIdsMostrados(ids: Set<string>): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids]))
  } catch {
    /* sessionStorage indisponível: os toasts só não persistem entre páginas */
  }
}

/**
 * Toasts (Sonner) das notificações, no canto inferior:
 *   - ACIONÁVEIS (aprovar/recusar/confirmar): card com botões.
 *   - INFORMATIVAS (ex.: "seu gestor aprovou"): toast simples — só quando
 *     CHEGAM em tempo real, não na carga inicial (senão o histórico viraria toast).
 *
 * Os ids já exibidos ficam no **sessionStorage**, então **navegar entre páginas
 * não faz os toasts reaparecerem** (o header/drawer remonta a cada página). Um
 * id novo (via SSE) vira toast uma única vez. Callbacks em refs → efeito depende
 * só da lista.
 */
export function useNotificacaoToasts(
  notificacoes: Notificacao[],
  aprovar: (id: string) => Promise<void> | void,
  recusar: (id: string, motivo: string) => Promise<void> | void,
  /** Clicar no corpo do toast (não nos botões) — decide a rota/dialog pelo tipo da notificação. */
  onAbrir?: (notificacao: Notificacao) => void,
  /** Marca a notificação como lida (ao clicar no corpo do toast). */
  onMarcarLida?: (id: string) => void,
) {
  const jaMostrados = useRef<Set<string> | null>(null)
  if (jaMostrados.current === null) jaMostrados.current = carregarIdsMostrados()
  // Só é "carga inicial" na primeira vez da sessão de aba (nada mostrado ainda).
  const cargaInicial = useRef(jaMostrados.current.size === 0)

  const aprovarRef = useRef(aprovar)
  const recusarRef = useRef(recusar)
  const abrirRef = useRef(onAbrir)
  const marcarLidaRef = useRef(onMarcarLida)
  aprovarRef.current = aprovar
  recusarRef.current = recusar
  abrirRef.current = onAbrir
  marcarLidaRef.current = onMarcarLida

  useEffect(() => {
    const mostrados = jaMostrados.current!
    let mudou = false

    for (const n of notificacoes) {
      if (mostrados.has(n.id)) continue
      mostrados.add(n.id)
      mudou = true

      if (n.requerAcao) {
        toast.custom(
          (t) => (
            <NotificacaoActionToast
              notificacao={n}
              onAprovar={(id) => aprovarRef.current(id)}
              onRecusar={(id, motivo) => recusarRef.current(id, motivo)}
              onClose={() => toast.dismiss(t)}
              onAbrir={
                abrirRef.current
                  ? () => {
                      marcarLidaRef.current?.(n.id)
                      abrirRef.current?.(n)
                      toast.dismiss(t)
                    }
                  : undefined
              }
            />
          ),
          { id: `notif-${n.id}`, duration: Infinity, unstyled: true },
        )
      } else if (!cargaInicial.current) {
        toast(`${n.nome} ${n.acao}`, {
          id: `notif-${n.id}`,
          description: n.detalhe || undefined,
          duration: 6000,
        })
      }
    }

    if (mudou) salvarIdsMostrados(mostrados)
    if (notificacoes.length > 0) cargaInicial.current = false
  }, [notificacoes])
}
