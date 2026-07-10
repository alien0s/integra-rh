import { useMemo, useState } from 'react'

import { AppLayout } from '@/features/app/components'
import { PontoTable, PontoTableActions } from '@/features/ponto/components'
import { usePonto } from '@/features/ponto/hooks'

/** Normaliza texto para busca (minúsculo, sem acento). */
function normalizar(valor: string) {
  return valor
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Página de Ponto — registros de jornada dos funcionários.
 */
export function PontoList() {
  const { registros, selecionados, isLoading, alternar, alternarTodos } =
    usePonto()
  const [search, setSearch] = useState('')

  const termo = normalizar(search.trim())
  const registrosFiltrados = useMemo(
    () =>
      termo
        ? registros.filter((r) => normalizar(r.funcionario.nome).includes(termo))
        : registros,
    [registros, termo],
  )

  return (
    <AppLayout
      title="Pontos"
      description="Home / Gestão de Pessoas / Pontos"
      breadcrumbs={[{ label: 'Pontos' }]}
    >
      <div className="flex flex-col gap-2">
        <PontoTableActions search={search} onSearchChange={setSearch} />

        {isLoading ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Carregando registros…
          </p>
        ) : (
          <PontoTable
            registros={registrosFiltrados}
            selecionados={selecionados}
            onAlternar={alternar}
            onAlternarTodos={alternarTodos}
          />
        )}
      </div>
    </AppLayout>
  )
}
