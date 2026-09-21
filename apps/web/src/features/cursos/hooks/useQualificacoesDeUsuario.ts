import { useEffect, useState } from 'react'

import { cursosService } from '../services'
import type { QualificacoesDeUsuario } from '../types'

/**
 * Busca as qualificações aprovadas de um colaborador sob demanda — usado na
 * linha expandida da tabela de Funcionários, só dispara quando `usuarioId`
 * é informado (ex.: ao expandir a linha), evitando buscar tudo de antemão.
 */
export function useQualificacoesDeUsuario(usuarioId: string | null) {
  const [data, setData] = useState<QualificacoesDeUsuario | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!usuarioId) {
      setData(null)
      return
    }

    let cancelado = false
    setIsLoading(true)
    cursosService
      .getDeUsuario(usuarioId)
      .then((resultado) => {
        if (!cancelado) setData(resultado)
      })
      .catch((error) => {
        console.error('Erro ao buscar qualificações do colaborador', error)
      })
      .finally(() => {
        if (!cancelado) setIsLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [usuarioId])

  return { data, isLoading }
}
