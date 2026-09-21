import { useCallback, useEffect, useState } from 'react'

import type { SolicitacaoFerias } from '@/features/ferias/types'
import {
  feriasService,
  type RegistrarFeriasManualInput,
} from '@/features/ferias/services'

/**
 * Hook da Visão geral: lista as solicitações (API) e aprova/recusa,
 * atualizando o item na lista local após a resposta do backend.
 *
 * `enabled=false` pula a busca — usado pelo COLABORADOR, que nem vê essa
 * aba (o backend também bloqueia GET /ferias pra ele; isso aqui só evita a
 * chamada desnecessária, já sabendo de antemão que vai dar 403).
 */
export function useFerias(enabled = true) {
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoFerias[]>([])
  const [isLoading, setIsLoading] = useState(enabled)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    try {
      setSolicitacoes(await feriasService.getSolicitacoes())
    } catch (error) {
      console.error('Erro ao buscar solicitações de férias', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (enabled) carregar()
  }, [enabled, carregar])

  /** 1ª etapa (gestor): aprova → AGUARDANDO_DP. Recarrega para refletir o progresso. */
  async function aprovar(id: string) {
    await feriasService.aprovar(id)
    await carregar()
  }

  /** 2ª etapa (DP): confirma → APROVADA. Recarrega para refletir o progresso. */
  async function confirmar(id: string) {
    await feriasService.confirmar(id)
    await carregar()
  }

  /**
   * 2ª etapa (alternativa à confirmação): DP devolve uma sugestão de nova
   * data → AJUSTE_SUGERIDO. Recarrega para refletir o período proposto.
   */
  async function sugerirAjuste(id: string, dataInicioSugerida: string, motivo: string) {
    await feriasService.sugerirAjuste(id, { dataInicioSugerida, motivo })
    await carregar()
  }

  /**
   * O colaborador aceita o ajuste sugerido (caso raro aqui — normalmente
   * feito na aba Pessoal; suportado também na Visão geral pra quando o
   * próprio gestor/DP tem uma solicitação sua na lista).
   */
  async function aceitarAjuste(id: string) {
    await feriasService.aceitarAjuste(id)
    await carregar()
  }

  /** Recusa com justificativa e reflete no item. */
  async function rejeitar(id: string, motivo: string) {
    await feriasService.recusar(id, motivo)
    setSolicitacoes((atual) =>
      atual.map((s) =>
        s.id === id ? { ...s, status: 'REJEITADA', motivoRejeicao: motivo } : s,
      ),
    )
  }

  /** Cancela e reflete no item (DP/ADMIN). */
  async function cancelar(id: string, motivo?: string | null) {
    await feriasService.cancelar(id, motivo)
    setSolicitacoes((atual) =>
      atual.map((s) => (s.id === id ? { ...s, status: 'CANCELADA' } : s)),
    )
  }

  /**
   * RH/Admin registra manualmente férias/folga já ocorridas (histórico).
   * Recarrega a lista pra já entrar ordenada e refletir o saldo atualizado.
   */
  async function registrarManual(input: RegistrarFeriasManualInput) {
    await feriasService.registrarManual(input)
    await carregar()
  }

  return {
    solicitacoes,
    isLoading,
    aprovar,
    confirmar,
    sugerirAjuste,
    aceitarAjuste,
    rejeitar,
    cancelar,
    registrarManual,
    recarregar: carregar,
  }
}
