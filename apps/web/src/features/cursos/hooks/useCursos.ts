import { useState, useEffect } from 'react'
import { cursosService } from '../services'
import type { CursosData } from '../types'

/**
 * Hook para buscar e gerenciar os dados de Cursos e Qualificações.
 */
export function useCursos() {
  const [data, setData] = useState<CursosData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true)
      try {
        const result = await cursosService.getCursosData()
        setData(result)
      } catch (error) {
        console.error('Erro ao buscar dados de cursos', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return {
    data,
    isLoading
  }
}
