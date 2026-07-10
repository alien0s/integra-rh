import { useEffect, useState } from 'react'

import type { RegistroPonto } from '@/features/ponto/types'
import { pontoService } from '@/features/ponto/services'

/**
 * Hook que busca os registros de ponto e controla a seleção das linhas.
 * Fins de semana já vêm desmarcados por padrão.
 */
export function usePonto() {
  const [registros, setRegistros] = useState<RegistroPonto[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      try {
        const data = await pontoService.getRegistros()
        if (!ativo) return
        setRegistros(data)
        // Seleciona por padrão os dias úteis (fim de semana desmarcado).
        setSelecionados(
          new Set(data.filter((r) => !r.fimDeSemana).map((r) => r.id)),
        )
      } catch (error) {
        console.error('Erro ao buscar registros de ponto', error)
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()
    return () => {
      ativo = false
    }
  }, [])

  /** Marca/desmarca uma linha. */
  function alternar(id: string, marcado: boolean) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (marcado) proximo.add(id)
      else proximo.delete(id)
      return proximo
    })
  }

  /** Marca/desmarca todas as linhas. */
  function alternarTodos(marcado: boolean) {
    setSelecionados(marcado ? new Set(registros.map((r) => r.id)) : new Set())
  }

  return { registros, selecionados, isLoading, alternar, alternarTodos }
}
