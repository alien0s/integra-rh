import { useEffect, useState } from 'react'

import type { OpcaoSelecao } from '@/features/usuarios/types'
import { usuariosService } from '@/features/usuarios/services'

/**
 * Hook que carrega as opções dos dropdowns de edição de usuário
 * (departamentos e funções).
 */
export function useOpcoesUsuario() {
  const [departamentos, setDepartamentos] = useState<OpcaoSelecao[]>([])
  const [funcoes, setFuncoes] = useState<OpcaoSelecao[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let ativo = true

    async function carregar() {
      setIsLoading(true)
      try {
        const [deps, funcs] = await Promise.all([
          usuariosService.getDepartamentos(),
          usuariosService.getFuncoes(),
        ])
        if (ativo) {
          setDepartamentos(deps)
          setFuncoes(funcs)
        }
      } catch (error) {
        console.error('Erro ao carregar opções de usuário', error)
      } finally {
        if (ativo) setIsLoading(false)
      }
    }

    carregar()

    return () => {
      ativo = false
    }
  }, [])

  return { departamentos, funcoes, isLoading }
}
