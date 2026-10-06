import { useCallback, useEffect, useState } from 'react'

import type {
  ColaboradorOpcao,
  CriarVrMesInput,
  EntidadeOpcao,
  EscopoVr,
  VrMes,
} from '@/features/vr/types'
import { vrService } from '@/features/vr/services'

/**
 * Hook da tela de VR: lista os meses, colaboradores e entidades (API), e
 * cadastra um novo mês — atualizando a lista local depois de cada ação.
 */
export function useVr() {
  const [meses, setMeses] = useState<VrMes[]>([])
  const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([])
  const [entidades, setEntidades] = useState<EntidadeOpcao[]>([])
  const [escopo, setEscopo] = useState<EscopoVr | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    try {
      setMeses(await vrService.getMeses())
    } catch (error) {
      console.error('Erro ao buscar os meses de VR', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
    vrService
      .getColaboradores()
      .then(setColaboradores)
      .catch((error) => console.error('Erro ao buscar colaboradores para o VR', error))
    vrService
      .getEscopo()
      .then(setEscopo)
      .catch((error) => console.error('Erro ao buscar o escopo do VR', error))
    vrService
      .getEntidades()
      .then(setEntidades)
      .catch((error) => console.error('Erro ao buscar entidades para o VR', error))
  }, [carregar])

  async function criar(input: CriarVrMesInput) {
    await vrService.criar(input)
    await carregar()
  }

  // Meses ainda abertos (só pode ter 1 por grupo) — usado pra travar o "Novo mês".
  const mesesAbertos = meses
    .filter((m) => !m.fechado)
    .map((m) => ({ grupo: m.grupo, mes: m.mes, ano: m.ano }))

  return {
    meses,
    colaboradores,
    entidades,
    escopo,
    mesesAbertos,
    isLoading,
    criar,
    recarregar: carregar,
  }
}