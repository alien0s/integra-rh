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
