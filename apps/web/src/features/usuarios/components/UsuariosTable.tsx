import { useMemo, useState } from 'react'

import { ChevronDown } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Usuario, UsuarioTableColumn } from '@/features/usuarios/types'

interface UsuariosTableProps {
  data: Usuario[]
  visibleColumns: UsuarioTableColumn[]
  onSelectUsuario?: (usuarioId: string) => void
}

const statusClassName = {
  Ativo:
    'border-transparent bg-emerald-100 text-emerald-600 hover:bg-emerald-100',
  Inativo:
    'border-transparent bg-red-50 text-red-500 hover:bg-red-50',
}

/**
 * Tabela de usuários com colunas controladas pelo menu de ocultar.
 */
export function UsuariosTable({
  data,
  visibleColumns,
  onSelectUsuario,
}: UsuariosTableProps) {
  const [selectedDepartamentos, setSelectedDepartamentos] = useState<string[]>(
    []
  )

  const allDepartamentos = useMemo(
    () =>
      [...new Set(data.map((u) => u.departamento).filter(Boolean))].sort(),
    [data]
  )

  const filteredData = useMemo(
    () =>
      selectedDepartamentos.length === 0
        ? data
        : data.filter((u) => selectedDepartamentos.includes(u.departamento)),
    [data, selectedDepartamentos]
  )

  function handleDepartamentoToggle(dep: string, checked: boolean) {
    setSelectedDepartamentos((prev) =>
      checked ? [...prev, dep] : prev.filter((d) => d !== dep)
    )
  }

  const isColumnVisible = (column: UsuarioTableColumn) =>
    visibleColumns.includes(column)
  const activeColumnCount = visibleColumns.length
  const hasVisibleColumns = activeColumnCount > 0

  return (
    <Card className="overflow-hidden shadow-none">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {hasVisibleColumns ? (
                <>
                  {isColumnVisible('nome') ? (
                    <TableHead className="h-11 px-6">Nome</TableHead>
                  ) : null}
                  {isColumnVisible('email') ? (
                    <TableHead className="h-11">E-mail</TableHead>
                  ) : null}
                  {isColumnVisible('funcao') ? (
                    <TableHead className="h-11">Função</TableHead>
                  ) : null}
                  {isColumnVisible('departamento') ? (
                    <TableHead className="h-11">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto gap-1 p-0 font-medium text-foreground hover:bg-transparent focus-visible:ring-0"
                          >
                            Departamento
                            {selectedDepartamentos.length > 0 && (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                {selectedDepartamentos.length}
                              </span>
                            )}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          {allDepartamentos.map((dep) => (
                            <DropdownMenuCheckboxItem
                              key={dep}
                              checked={selectedDepartamentos.includes(dep)}
                              onCheckedChange={(checked) =>
                                handleDepartamentoToggle(dep, checked === true)
                              }
                              onSelect={(e) => e.preventDefault()}
                              className="h-9"
                            >
                              {dep}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                  ) : null}
                  {isColumnVisible('status') ? (
                    <TableHead className="h-11 w-36 pr-6">Status</TableHead>
                  ) : null}
                </>
              ) : (
                <TableHead className="h-11 px-6">Colunas</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasVisibleColumns ? (
              <TableRow>
                <TableCell className="h-24 px-6 text-center text-sm text-muted-foreground">
                  Nenhuma coluna selecionada.
                </TableCell>
              </TableRow>
            ) : filteredData.length > 0 ? (
              filteredData.map((usuario) => (
                <TableRow
                  key={usuario.id}
                  tabIndex={onSelectUsuario ? 0 : undefined}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onSelectUsuario?.(usuario.id)}
                  onKeyDown={(event) => {
                    if (!onSelectUsuario) return
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelectUsuario(usuario.id)
                    }
                  }}
                >
                  {isColumnVisible('nome') ? (
                    <TableCell className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-lg">
                          <AvatarImage
                            src={usuario.fotoUrl}
                            alt={usuario.nome}
                            className="rounded-lg"
                          />
                          <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                            {usuario.iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium leading-none">
                          {usuario.nome}
                        </span>
                      </div>
                    </TableCell>
                  ) : null}

                  {isColumnVisible('email') ? (
                    <TableCell className="text-sm text-muted-foreground">
                      {usuario.email}
                    </TableCell>
                  ) : null}

                  {isColumnVisible('funcao') ? (
                    <TableCell className="text-sm text-muted-foreground">
                      {usuario.funcao}
                    </TableCell>
                  ) : null}

                  {isColumnVisible('departamento') ? (
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {usuario.departamento}
                    </TableCell>
                  ) : null}

                  {isColumnVisible('status') ? (
                    <TableCell className="pr-6">
                      <Badge
                        variant="outline"
                        className={`min-w-16 justify-center rounded-lg px-2 py-1 text-xs font-medium shadow-none ${statusClassName[usuario.status]}`}
                      >
                        {usuario.status}
                      </Badge>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={activeColumnCount}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {selectedDepartamentos.length > 0
                    ? 'Nenhum usuário no departamento selecionado.'
                    : 'Nenhum usuário encontrado.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
