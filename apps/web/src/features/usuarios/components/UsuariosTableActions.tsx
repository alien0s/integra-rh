import { useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
  Table2,
  Upload,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ImportarUsuariosDialog } from '@/features/usuarios/components/ImportarUsuariosDialog'
import {
  exportarUsuariosExcel,
  exportarUsuariosPdf,
} from '@/features/usuarios/services'
import type {
  Usuario,
  UsuarioTableColumn,
  UsuarioView,
} from '@/features/usuarios/types'

interface UsuariosTableActionsProps {
  search: string
  visibleColumns: UsuarioTableColumn[]
  view: UsuarioView
  /** Usuários a exportar (Excel/PDF). */
  usuarios: Usuario[]
  onSearchChange: (value: string) => void
  onVisibleColumnsChange: (columns: UsuarioTableColumn[]) => void
  onViewChange: (view: UsuarioView) => void
  /** Chamado após uma importação bem-sucedida (para recarregar a lista). */
  onImportComplete?: () => void
}

const viewButtonClassName =
  'text-muted-foreground hover:bg-muted hover:text-foreground'
const activeViewButtonClassName = 'bg-muted text-foreground hover:bg-muted'
const tableColumns: { id: UsuarioTableColumn; label: string }[] = [
  { id: 'nome', label: 'Nome' },
  { id: 'email', label: 'E-mail' },
  { id: 'funcao', label: 'Função' },
  { id: 'departamento', label: 'Departamento' },
  { id: 'status', label: 'Status' },
]

/**
 * Ações de visualização e controle da tabela de usuários.
 */
export function UsuariosTableActions({
  search,
  visibleColumns,
  view,
  usuarios,
  onSearchChange,
  onVisibleColumnsChange,
  onViewChange,
  onImportComplete,
}: UsuariosTableActionsProps) {
  const [importarAberto, setImportarAberto] = useState(false)

  function handleColumnVisibilityChange(
    column: UsuarioTableColumn,
    checked: boolean
  ) {
    if (checked) {
      onVisibleColumnsChange(
        visibleColumns.includes(column)
          ? visibleColumns
          : [...visibleColumns, column]
      )
      return
    }

    onVisibleColumnsChange(
      visibleColumns.filter((currentColumn) => currentColumn !== column)
    )
  }

  return (
    <div className="flex min-h-11 flex-col gap-3 bg-background px-1 py-2 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={view === 'tabela' ? activeViewButtonClassName : viewButtonClassName}
            aria-pressed={view === 'tabela'}
            onClick={() => onViewChange('tabela')}
          >
            <Table2 className="h-4 w-4" />
            Tabela
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={view === 'quadro' ? activeViewButtonClassName : viewButtonClassName}
            aria-pressed={view === 'quadro'}
            onClick={() => onViewChange('quadro')}
          >
            <LayoutGrid className="h-4 w-4" />
            Quadro
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <div className="relative w-full sm:w-56">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Pesquisar"
            className="h-8 bg-background pl-8 shadow-none"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
              Ocultar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {tableColumns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                checked={visibleColumns.includes(column.id)}
                onCheckedChange={(checked) =>
                  handleColumnVisibilityChange(column.id, checked === true)
                }
                onSelect={(event) => event.preventDefault()}
                className="h-9"
              >
                {column.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label="Mais ações"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-background"
          onClick={() => setImportarAberto(true)}
        >
          <Upload className="h-4 w-4" />
          Importar
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-background">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => exportarUsuariosExcel(usuarios)}>
              <FileSpreadsheet className="h-4 w-4" />
              Arquivo Excel
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportarUsuariosPdf(usuarios)}>
              <FileText className="h-4 w-4" />
              PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ImportarUsuariosDialog
        open={importarAberto}
        onOpenChange={setImportarAberto}
        onImported={onImportComplete}
      />
    </div>
  )
}
