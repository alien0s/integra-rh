import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppLayout } from '@/features/app/components/AppLayout'
import {
  UsuariosTable,
  UsuariosTableActions,
} from '@/features/usuarios/components'
import { usuarios } from '@/features/usuarios/data/usuarios'
import type { UsuarioTableColumn } from '@/features/usuarios/types'

const defaultVisibleColumns: UsuarioTableColumn[] = [
  'nome',
  'email',
  'funcao',
  'departamento',
  'status',
]

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Página de listagem de usuários cadastrados no sistema.
 */
export function UsuariosList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<UsuarioTableColumn[]>(
    defaultVisibleColumns
  )
  const searchTerm = normalizeSearchValue(search.trim())
  const filteredUsuarios = useMemo(() => {
    if (!searchTerm) {
      return usuarios
    }

    return usuarios.filter((usuario) => {
      const searchableContent = normalizeSearchValue(
        [
          usuario.nome,
          usuario.email,
          usuario.funcao,
          usuario.departamento,
          usuario.status,
        ].join(' ')
      )

      return searchableContent.includes(searchTerm)
    })
  }, [searchTerm])

  return (
    <AppLayout
      title="Usuários"
      description="Home / Gestão de Pessoas / Usuários"
      breadcrumbs={[{ label: 'Usuários' }]}
    >
      <div className="flex flex-col gap-4">
        <UsuariosTableActions
          search={search}
          visibleColumns={visibleColumns}
          onSearchChange={setSearch}
          onVisibleColumnsChange={setVisibleColumns}
        />
        <UsuariosTable
          data={filteredUsuarios}
          visibleColumns={visibleColumns}
          onSelectUsuario={(usuarioId) => navigate(`/usuarios/${usuarioId}`)}
        />
      </div>
    </AppLayout>
  )
}
