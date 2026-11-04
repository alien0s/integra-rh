import { useCallback, useEffect, useState } from 'react'

import type { ModuloVisibilidade } from '@/features/tabelas/types'
import { tabelasService } from '@/features/tabelas/services'

/**
 * Hook da seção "Visibilidade de módulos" (tela Tabelas, ADMIN): carrega as
 * exceções cadastradas (tabela esparsa — ausência de uma combinação módulo+
 * papel = visível e sem cadeado, defaults) e expõe `alternar` para ligar/
 * desligar uma célula da matriz — `visivel` (enxerga o módulo) ou
 * `liberadoAntecipado` (sem cadeado durante o lançamento beta) — atualizando
 * o estado local com a resposta da API ao concluir.
 */
export function useModulosVisibilidade() {
  const [overrides, setOverrides] = useState<ModuloVisibilidade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setOverrides(await tabelasService.getModulosVisibilidade())
    } catch {
      setError('Não foi possível carregar a visibilidade dos módulos.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  /** Liga/desliga uma das duas exceções (visivel/liberadoAntecipado) de um módulo para um papel. */
  async function alternar(
    moduloCodigo: string,
    roleId: string,
    campo: 'visivel' | 'liberadoAntecipado',
    valor: boolean,
  ) {
    const atualizado =
      campo === 'visivel'
        ? await tabelasService.definirVisibilidadeModulo(moduloCodigo, roleId, valor)
        : await tabelasService.definirLiberadoAntecipadoModulo(moduloCodigo, roleId, valor)

    setOverrides((lista) => {
      const existe = lista.some(
        (o) => o.moduloCodigo === moduloCodigo && o.roleId === roleId,
      )
      return existe
        ? lista.map((o) =>
            o.moduloCodigo === moduloCodigo && o.roleId === roleId ? atualizado : o,
          )
        : [...lista, atualizado]
    })
  }

  return { overrides, isLoading, error, alternar }
}
