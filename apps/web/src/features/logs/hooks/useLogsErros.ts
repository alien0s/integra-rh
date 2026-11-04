import { useCallback, useEffect, useState } from 'react'

import { logsService } from '../services/logsService'
import type { LogErro } from '../types'

/**
 * Hook de Logs: carrega os últimos erros inesperados do backend (mais
 * recentes primeiro).
 */
export function useLogsErros() {
  const [logs, setLogs] = useState<LogErro[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    try {
      setLogs(await logsService.listar())
    } catch (error) {
      console.error('Erro ao buscar os logs', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  return { logs, isLoading, recarregar: carregar }
}
