import { useEffect, useMemo, useState } from 'react'

import { ChevronDown, ChevronLeft, ChevronRight, Ellipsis, Pencil, Trash2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
  onEditarUsuario?: (usuario: Usuario) => void
  onExcluirUsuario?: (usuarioId: string) => Promise<unknown> | void
}

const statusClassName = {
  Ativo:
    'border-transparent bg-emerald-100 text-emerald-600 hover:bg-emerald-100',
  Inativo:
    'border-transparent bg-red-50 text-red-500 hover:bg-red-50',
}

/** Máximo de linhas exibidas por página. */
const ITENS_POR_PAGINA = 20

/**
 * Tabela de usuários com colunas controladas pelo menu de ocultar.
 */
export function UsuariosTable({
  data,
  visibleColumns,
  onSelectUsuario,
  onEditarUsuario,
  onExcluirUsuario,
}: UsuariosTableProps) {
  const [selectedSetores, setSelectedSetores] = useState<string[]>(
    []
  )
  const [selectedFuncoes, setSelectedFuncoes] = useState<string[]>([])
  // Usuário aguardando confirmação de exclusão (null = dialog fechado).
  const [usuarioParaExcluir, setUsuarioParaExcluir] = useState<Usuario | null>(
    null
  )
  const [excluindo, setExcluindo] = useState(false)

  async function confirmarExclusao() {
    if (!usuarioParaExcluir) return
    setExcluindo(true)
    try {
      await onExcluirUsuario?.(usuarioParaExcluir.id)
      setUsuarioParaExcluir(null)
    } catch (erro) {
      console.error(erro)
    } finally {
      setExcluindo(false)
    }
  }

  const allSetores = useMemo(
    () =>
      [...new Set(data.map((u) => u.setor).filter(Boolean))].sort(),
    [data]
  )

  const allFuncoes = useMemo(
    () => [...new Set(data.map((u) => u.funcao).filter(Boolean))].sort(),
    [data]
  )

  const filteredData = useMemo(
    () =>
      data.filter(
        (u) =>
          (selectedSetores.length === 0 ||
            selectedSetores.includes(u.setor)) &&
          (selectedFuncoes.length === 0 || selectedFuncoes.includes(u.funcao))
      ),
    [data, selectedSetores, selectedFuncoes]
  )

  const hasActiveFilters =
    selectedSetores.length > 0 || selectedFuncoes.length > 0

  const [pagina, setPagina] = useState(1)

  // Volta pra página 1 sempre que a base de dados ou os filtros mudam (senão
  // o usuário pode ficar "preso" numa página que não existe mais depois de
  // filtrar/buscar).
  useEffect(() => {
    setPagina(1)
  }, [data, selectedSetores, selectedFuncoes])

  const totalPaginas = Math.max(
    1,
    Math.ceil(filteredData.length / ITENS_POR_PAGINA),
  )
  // Trava dentro do intervalo válido — cobre o caso de a página guardada
  // ficar maior que o total depois de um filtro reduzir os resultados.
  const paginaAtual = Math.min(pagina, totalPaginas)
  const primeiroItem =
    filteredData.length === 0 ? 0 : (paginaAtual - 1) * ITENS_POR_PAGINA + 1
  const ultimoItem = Math.min(paginaAtual * ITENS_POR_PAGINA, filteredData.length)
  const dadosPaginados = useMemo(
    () =>
      filteredData.slice(
        (paginaAtual - 1) * ITENS_POR_PAGINA,
        paginaAtual * ITENS_POR_PAGINA,
      ),
    [filteredData, paginaAtual],
  )

  function handleSetorToggle(setor: string, checked: boolean) {
    setSelectedSetores((prev) =>
      checked ? [...prev, setor] : prev.filter((s) => s !== setor)
    )
  }

  function handleFuncaoToggle(funcao: string, checked: boolean) {
    setSelectedFuncoes((prev) =>
      checked ? [...prev, funcao] : prev.filter((f) => f !== funcao)
    )
  }

  const isColumnVisible = (column: UsuarioTableColumn) =>
    visibleColumns.includes(column)
  const activeColumnCount = visibleColumns.length
  const hasVisibleColumns = activeColumnCount > 0

  return (
    <>
    <Card className="flex h-full flex-col overflow-hidden shadow-none">
      {/* Só esta região rola — cabeçalho (sticky) e paginação (fora daqui,
          no footer abaixo) ficam sempre visíveis. */}
      <CardContent className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-0">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
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
                    <TableHead className="h-11">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto gap-1 p-0 font-medium text-foreground hover:bg-transparent focus-visible:ring-0"
                          >
                            Função
                            {selectedFuncoes.length > 0 && (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                {selectedFuncoes.length}
                              </span>
                            )}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          {allFuncoes.map((funcao) => (
                            <DropdownMenuCheckboxItem
                              key={funcao}
                              checked={selectedFuncoes.includes(funcao)}
                              onCheckedChange={(checked) =>
                                handleFuncaoToggle(funcao, checked === true)
                              }
                              onSelect={(e) => e.preventDefault()}
                              className="h-9"
                            >
                              {funcao}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                  ) : null}
                  {isColumnVisible('setor') ? (
                    <TableHead className="h-11">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto gap-1 p-0 font-medium text-foreground hover:bg-transparent focus-visible:ring-0"
                          >
                            Setor
                            {selectedSetores.length > 0 && (
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                                {selectedSetores.length}
                              </span>
                            )}
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          {allSetores.map((setor) => (
                            <DropdownMenuCheckboxItem
                              key={setor}
                              checked={selectedSetores.includes(setor)}
                              onCheckedChange={(checked) =>
                                handleSetorToggle(setor, checked === true)
                              }
                              onSelect={(e) => e.preventDefault()}
                              className="h-9"
                            >
                              {setor}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableHead>
                  ) : null}
                  {isColumnVisible('status') ? (
                    <TableHead className="h-11 w-36">Status</TableHead>
                  ) : null}
                  <TableHead className="h-11 w-12 pr-6" />
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
              dadosPaginados.map((usuario) => (
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

                  {isColumnVisible('setor') ? (
                    <TableCell className="pr-6 text-sm text-muted-foreground">
                      {usuario.setor}
                    </TableCell>
                  ) : null}

                  {isColumnVisible('status') ? (
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`min-w-16 justify-center rounded-lg px-2 py-1 text-xs font-medium shadow-none ${statusClassName[usuario.status]}`}
                      >
                        {usuario.status}
                      </Badge>
                    </TableCell>
                  ) : null}

                  <TableCell
                    className="w-12 pr-6 text-right"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          aria-label="Ações"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onSelect={() => onEditarUsuario?.(usuario)}
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                          onSelect={() => setUsuarioParaExcluir(usuario)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={activeColumnCount + 1}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {hasActiveFilters
                    ? 'Nenhum usuário para os filtros selecionados.'
                    : 'Nenhum usuário encontrado.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Fora da área de scroll (shrink-0) — fica sempre visível, não rola
          junto com as linhas. */}
      {filteredData.length > 0 && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            Mostrando {primeiroItem}–{ultimoItem} de {filteredData.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaAtual <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="px-1 text-xs">
              Página {paginaAtual} de {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual >= totalPaginas}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>

    <AlertDialog
      open={usuarioParaExcluir !== null}
      onOpenChange={(aberto) => {
        if (!aberto && !excluindo) setUsuarioParaExcluir(null)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir{' '}
            <span className="font-medium text-foreground">
              {usuarioParaExcluir?.nome}
            </span>
            ? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white transition-colors hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
            disabled={excluindo}
            onClick={(event) => {
              event.preventDefault()
              confirmarExclusao()
            }}
          >
            {excluindo ? 'Excluindo…' : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
