import { useEffect, useState } from 'react'

import type { OpcaoSelecao } from '@/features/usuarios/types'
import { usuariosService } from '@/features/usuarios/services'
import { tabelasService } from '@/features/tabelas/services'
import type { Papel } from '@/features/tabelas/types'

/**
 * Hook que carrega as opções dos dropdowns de edição de usuário
 * (setores, funções e papéis). Papéis vem da mesma API da tela Tabelas —
 * evita ter uma lista de papéis fixa no código, desatualizada em relação
 * ao que foi cadastrado lá.
 *
 * `enabled=false` pula a busca — usado quando o editor não tem esses
 * dropdowns na tela (ex.: COLABORADOR editando o próprio perfil, restrito a
 * cpf/telefone) e a API bloquearia papéis/entidades pra esse papel mesmo.
 */
export function useOpcoesUsuario(enabled = true) {
  const [setores, setSetores] = useState<OpcaoSelecao[]>([])
  const [funcoes, setFuncoes] = useState<OpcaoSelecao[]>([])
  const [papeis, setPapeis] = useState<Papel[]>([])
  const [isLoading, setIsLoading] = useState(enabled)

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false)
      return
    }

    let ativo = true

    async function carregar() {
      setIsLoading(true)
      try {
        const [setoresData, funcs, papeisData] = await Promise.all([
          usuariosService.getSetores(),
          usuariosService.getFuncoes(),
          tabelasService.getPapeis(),
        ])
        if (ativo) {
          setSetores(setoresData)
          setFuncoes(funcs)
          setPapeis(papeisData)
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
  }, [enabled])

  return { setores, funcoes, papeis, isLoading }
}
