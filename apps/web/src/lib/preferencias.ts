import { useCallback, useState } from 'react'

/**
 * Preferências locais do usuário (persistidas no localStorage).
 * Simples por enquanto — se um dia virarem preferências de conta, migram p/ API.
 */

const FERIAS_30_KEY = 'pref_ferias_30_dias'

/** Lê se o preenchimento automático de 30 dias de férias está ligado. */
export function getFerias30Dias(): boolean {
  return localStorage.getItem(FERIAS_30_KEY) === 'true'
}

/** Salva a preferência de 30 dias automáticos de férias. */
export function setFerias30Dias(ativo: boolean): void {
  localStorage.setItem(FERIAS_30_KEY, String(ativo))
}

/**
 * Hook para a preferência "30 dias automáticos de férias".
 * Retorna o valor atual e uma função para alterá-lo (persistindo).
 */
export function usePreferenciaFerias30(): [boolean, (ativo: boolean) => void] {
  const [ativo, setAtivo] = useState(getFerias30Dias)

  const alterar = useCallback((valor: boolean) => {
    setFerias30Dias(valor)
    setAtivo(valor)
  }, [])

  return [ativo, alterar]
}

/* ── Modo de visualização da Visão geral de Férias ─────────────────────────── */

const FERIAS_VISAO_KEY = 'pref_ferias_visao'

/** Modos de exibição das requisições: cards ou linha do tempo (calendário). */
export type ModoVisaoFerias = 'cards' | 'timeline'

/** Lê o modo salvo (default 'cards'). Tolerante a localStorage indisponível. */
export function getModoVisaoFerias(): ModoVisaoFerias {
  try {
    return localStorage.getItem(FERIAS_VISAO_KEY) === 'timeline'
      ? 'timeline'
      : 'cards'
  } catch {
    return 'cards'
  }
}

/** Salva o modo de visualização. */
export function setModoVisaoFerias(modo: ModoVisaoFerias): void {
  try {
    localStorage.setItem(FERIAS_VISAO_KEY, modo)
  } catch {
    /* localStorage indisponível: ignora (mantém só em memória) */
  }
}

/** Hook do modo de visualização (persistido no localStorage). */
export function usePreferenciaVisaoFerias(): [
  ModoVisaoFerias,
  (modo: ModoVisaoFerias) => void,
] {
  const [modo, setModoState] = useState(getModoVisaoFerias)

  const alterar = useCallback((novo: ModoVisaoFerias) => {
    setModoVisaoFerias(novo)
    setModoState(novo)
  }, [])

  return [modo, alterar]
}
