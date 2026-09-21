import { useCallback, useEffect, useMemo, useState } from 'react'

import { getToken } from '@/lib/auth'
import type { Notificacao } from '@/features/notificacoes/types'
import { notificacoesService } from '@/features/notificacoes/services'
import { feriasService } from '@/features/ferias/services'

/**
 * Fallback (SSE é a via principal): polling mais espaçado, só como rede de
 * segurança caso a conexão em tempo real caia/proxy bufferize.
 */
const INTERVALO_POLLING_MS = 60_000

/**
 * Hook das notificações do usuário logado (API): lista, contagem de não-lidas,
 * marcar todas como lidas e responder às acionáveis (Aprovar/Recusar).
 *
 * Tempo real via **SSE** (`GET /notificacoes/stream`): o backend empurra um
 * evento assim que uma notificação é criada (aprovação do gestor, confirmação
 * do DP, recusa, cancelamento…) e aqui refazemos a busca na hora. Um polling
 * silencioso de 60s serve de fallback (pausa com aba oculta, refetch ao focar).
 */
export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setIsLoading(true)
    try {
      setNotificacoes(await notificacoesService.getNotificacoes())
    } catch (error) {
      console.error('Erro ao carregar notificações', error)
    } finally {
      if (!silencioso) setIsLoading(false)
    }
  }, [])

  // Carga inicial (com indicador de loading).
  useEffect(() => {
    carregar()
  }, [carregar])

  // Tempo real via SSE: ao receber o gatilho, refaz a busca silenciosamente.
  // O EventSource não manda header, então o token vai por query. Ele reconecta
  // sozinho em caso de queda (retry nativo).
  useEffect(() => {
    const token = getToken()
    if (!token) return
    const es = new EventSource(
      `/api/notificacoes/stream?token=${encodeURIComponent(token)}`,
    )
    es.addEventListener('notificacao', () => carregar(true))
    return () => es.close()
  }, [carregar])

  // Polling silencioso + pausa com aba oculta + refetch ao focar.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') carregar(true)
    }, INTERVALO_POLLING_MS)

    function aoFocar() {
      if (document.visibilityState === 'visible') carregar(true)
    }
    document.addEventListener('visibilitychange', aoFocar)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoFocar)
    }
  }, [carregar])

  const naoLidas = useMemo(
    () => notificacoes.filter((n) => !n.lida).length,
    [notificacoes],
  )

  /** Marca todas como lidas (API + estado local). */
  async function marcarTodasComoLidas() {
    await notificacoesService.marcarTodasLidas()
    setNotificacoes((anteriores) =>
      anteriores.map((n) => (n.lida ? n : { ...n, lida: true })),
    )
  }

  /** Marca UMA como lida (ao clicar ou agir na notificação). */
  async function marcarComoLida(id: string) {
    setNotificacoes((anteriores) =>
      anteriores.map((n) => (n.id === id ? { ...n, lida: true } : n)),
    )
    try {
      await notificacoesService.marcarLida(id)
    } catch {
      /* silencioso: o estado local já reflete a leitura */
    }
  }

  /**
   * Age no recurso de origem da notificação (hoje: férias) e recarrega. A ação
   * "aprovar" respeita a ETAPA: card do gestor (…_SOLICITADA) aprova a 1ª etapa;
   * card do DP (…_AGUARDA_DP) confirma a 2ª. A recusa exige um motivo.
   */
  async function agirNaReferencia(
    id: string,
    decisao: 'aprovar' | 'recusar',
    motivo?: string,
  ) {
    const alvo = notificacoes.find((n) => n.id === id)
    if (!alvo?.referenciaId) return

    if (alvo.referenciaTabela === 'ferias_solicitacoes') {
      if (decisao === 'aprovar') {
        if (alvo.tipo?.endsWith('_AGUARDA_DP')) {
          await feriasService.confirmar(alvo.referenciaId)
        } else {
          await feriasService.aprovar(alvo.referenciaId)
        }
      } else {
        await feriasService.recusar(alvo.referenciaId, motivo?.trim() || 'Recusado')
      }
    }
    await marcarComoLida(id)
    await carregar()
  }

  const aprovar = (id: string) => agirNaReferencia(id, 'aprovar')
  const recusar = (id: string, motivo?: string) =>
    agirNaReferencia(id, 'recusar', motivo)

  return {
    notificacoes,
    isLoading,
    naoLidas,
    marcarTodasComoLidas,
    marcarComoLida,
    aprovar,
    recusar,
  }
}
