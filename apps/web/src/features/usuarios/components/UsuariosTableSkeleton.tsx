import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { UsuarioTableColumn } from '@/features/usuarios/types'

interface UsuariosTableSkeletonProps {
  visibleColumns: UsuarioTableColumn[]
}

/** Quantidade de linhas fantasma exibidas enquanto os usuários carregam. */
const LINHAS_SKELETON = 8

/**
 * Skeleton da tabela de usuários. Mantém a estrutura real (cabeçalho, card,
 * larguras) fixa — só o que vem do banco (avatar, nome, e-mail, função,
 * setor, status) recebe shimmer. O cabeçalho perde os filtros (dependem dos
 * dados ainda não carregados) mas mantém os rótulos das colunas.
 */
export function UsuariosTableSkeleton({
  visibleColumns,
}: UsuariosTableSkeletonProps) {
  const isColumnVisible = (column: UsuarioTableColumn) =>
    visibleColumns.includes(column)

  return (
    <Card className="flex h-full flex-col overflow-hidden shadow-none">
      <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
        <Table>
          <TableHeader className="bg-card">
            <TableRow className="hover:bg-transparent">
              {isColumnVisible('nome') ? (
                <TableHead className="h-11 px-6">Nome</TableHead>
              ) : null}
              {isColumnVisible('email') ? (
                <TableHead className="h-11">E-mail</TableHead>
              ) : null}
              {isColumnVisible('funcao') ? (
                <TableHead className="h-11">Função</TableHead>
              ) : null}
              {isColumnVisible('setor') ? (
                <TableHead className="h-11">Setor</TableHead>
              ) : null}
              {isColumnVisible('status') ? (
                <TableHead className="h-11 w-36">Status</TableHead>
              ) : null}
              <TableHead className="h-11 w-12 pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: LINHAS_SKELETON }).map((_, linha) => (
              <TableRow key={linha} className="hover:bg-transparent">
                {isColumnVisible('nome') ? (
                  <TableCell className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
                      <Skeleton className="h-3.5 w-32" />
                    </div>
                  </TableCell>
                ) : null}

                {isColumnVisible('email') ? (
                  <TableCell>
                    <Skeleton className="h-3.5 w-40" />
                  </TableCell>
                ) : null}

                {isColumnVisible('funcao') ? (
                  <TableCell>
                    <Skeleton className="h-3.5 w-28" />
                  </TableCell>
                ) : null}

                {isColumnVisible('setor') ? (
                  <TableCell className="pr-6">
                    <Skeleton className="h-3.5 w-24" />
                  </TableCell>
                ) : null}

                {isColumnVisible('status') ? (
                  <TableCell>
                    <Skeleton className="h-5 w-16 rounded-lg" />
                  </TableCell>
                ) : null}

                <TableCell className="w-12 pr-6" />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
