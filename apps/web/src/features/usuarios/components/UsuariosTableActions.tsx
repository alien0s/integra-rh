import {
  Download,
  LayoutGrid,
  List,
  MoreHorizontal,
  PlusCircle,
  Search,
  Settings2,
  SlidersHorizontal,
  Table2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { UsuarioTableColumn } from '@/features/usuarios/types'

interface UsuariosTableActionsProps {
  search: string
  visibleColumns: UsuarioTableColumn[]
  onSearchChange: (value: string) => void
  onVisibleColumnsChange: (columns: UsuarioTableColumn[]) => void
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
  onSearchChange,
  onVisibleColumnsChange,
}: UsuariosTableActionsProps) {
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
            className={activeViewButtonClassName}
            aria-pressed="true"
          >
            <Table2 className="h-4 w-4" />
            Tabela
          </Button>
          <Button variant="ghost" size="sm" className={viewButtonClassName}>
            <LayoutGrid className="h-4 w-4" />
            Quadro
          </Button>
          <Button variant="ghost" size="sm" className={viewButtonClassName}>
            <List className="h-4 w-4" />
            Lista
          </Button>
        </div>

        <div className="flex h-9 items-center gap-1 rounded-lg border border-dashed bg-background px-2">
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-1.5">
            <PlusCircle className="h-4 w-4" />
            Status
          </Button>
          <div className="h-5 w-px bg-border" />
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
            Ativo
          </span>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
            Inativo
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2">
            Resetar
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            aria-label="Limpar filtros"
          >
            <X className="h-4 w-4" />
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
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Settings2 className="h-4 w-4" />
          Personalizar
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label="Mais ações"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="bg-background">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>
    </div>
  )
}
