import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppLayout } from '@/features/app/components/AppLayout'
import {
  EditarUsuarioModal,
  UsuariosGrid,
  UsuariosTable,
  UsuariosTableActions,
} from '@/features/usuarios/components'
import { useOpcoesUsuario, useUsuarios } from '@/features/usuarios/hooks'
import { useEntidades } from '@/features/tabelas/hooks'
import type {
  AtualizarUsuarioInput,
  Usuario,
  UsuarioTableColumn,
  UsuarioView,
} from '@/features/usuarios/types'

const defaultVisibleColumns: UsuarioTableColumn[] = [
  'nome',
  'email',
  'funcao',
  'setor',
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
  // Dados vêm da API (tabela users com JOINs).
  const { usuarios, isLoading, error, atualizarUsuario, excluirUsuario, recarregar } =
    useUsuarios()
  // Opções dos dropdowns do modal de edição.
  const { setores, funcoes, papeis } = useOpcoesUsuario()
  const { entidades } = useEntidades()
  const [search, setSearch] = useState('')
  const [view, setView] = useState<UsuarioView>('tabela')
  const [visibleColumns, setVisibleColumns] = useState<UsuarioTableColumn[]>(
    defaultVisibleColumns
  )
  // Usuário em edição (null = modal fechado) e estado de salvamento.
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Usuario | null>(null)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvarEdicao(input: AtualizarUsuarioInput) {
    if (!usuarioEmEdicao) return
    setSalvando(true)
    try {
      await atualizarUsuario(usuarioEmEdicao.id, input)
      setUsuarioEmEdicao(null)
    } catch (erro) {
      console.error(erro)
      // Em produção: exibir toast com a mensagem de erro.
    } finally {
      setSalvando(false)
    }
  }
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
          usuario.setor,
          usuario.status,
        ].join(' ')
      )

      return searchableContent.includes(searchTerm)
    })
  }, [searchTerm, usuarios])

  return (
    <AppLayout
      title="Usuários"
      description="Home / Gestão de Pessoas / Usuários"
      breadcrumbs={[{ label: 'Usuários' }]}
      fillHeight
    >
      <div className="flex h-full min-h-0 flex-col gap-4">
        <UsuariosTableActions
          search={search}
          visibleColumns={visibleColumns}
          view={view}
          usuarios={usuarios}
          setores={setores}
          onSearchChange={setSearch}
          onVisibleColumnsChange={setVisibleColumns}
          onViewChange={setView}
          onImportComplete={recarregar}
          onGerenteAtribuido={recarregar}
        />
        {error ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-destructive">
            {error}
          </p>
        ) : isLoading ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Carregando usuários…
          </p>
        ) : (
          // flex-1 min-h-0: ocupa a altura restante (abaixo da barra de
          // busca/filtros) e vira a única região com scroll — sidebar e
          // cabeçalho ficam fixos. overflow-y-auto cobre a visão em quadro
          // (que não pagina/rola sozinha); a tabela pagina internamente.
          <div className="min-h-0 flex-1 overflow-y-auto">
            {view === 'quadro' ? (
              <UsuariosGrid
                data={filteredUsuarios}
                onSelectUsuario={(usuarioId) => navigate(`/usuarios/${usuarioId}`)}
              />
            ) : (
              <UsuariosTable
                data={filteredUsuarios}
                visibleColumns={visibleColumns}
                onSelectUsuario={(usuarioId) => navigate(`/usuarios/${usuarioId}`)}
                onEditarUsuario={setUsuarioEmEdicao}
                onExcluirUsuario={excluirUsuario}
              />
            )}
          </div>
        )}
      </div>

      <EditarUsuarioModal
        usuario={usuarioEmEdicao}
        entidades={entidades}
        setores={setores}
        funcoes={funcoes}
        papeis={papeis}
        isSaving={salvando}
        onClose={() => setUsuarioEmEdicao(null)}
        onSalvar={handleSalvarEdicao}
      />
    </AppLayout>
  )
}
