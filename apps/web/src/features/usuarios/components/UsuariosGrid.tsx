import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

import type { Usuario } from '@/features/usuarios/types'

interface UsuariosGridProps {
  data: Usuario[]
  onSelectUsuario?: (usuarioId: string) => void
}

const statusClassName = {
  Ativo:
    'border-transparent bg-emerald-100 text-emerald-600 hover:bg-emerald-100',
  Inativo: 'border-transparent bg-red-50 text-red-500 hover:bg-red-50',
}

/**
 * Visualização dos usuários em blocos/quadro (cards).
 */
export function UsuariosGrid({ data, onSelectUsuario }: UsuariosGridProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Nenhum usuário encontrado.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.map((usuario) => (
        <Card
          key={usuario.id}
          tabIndex={onSelectUsuario ? 0 : undefined}
          className="cursor-pointer shadow-none transition-colors hover:bg-muted/50"
          onClick={() => onSelectUsuario?.(usuario.id)}
          onKeyDown={(event) => {
            if (!onSelectUsuario) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelectUsuario(usuario.id)
            }
          }}
        >
          <CardContent className="relative flex flex-col gap-4 p-5">
            <Badge
              variant="outline"
              className={`absolute right-4 top-4 min-w-16 justify-center rounded-lg px-2 py-1 text-xs font-medium shadow-none ${statusClassName[usuario.status]}`}
            >
              {usuario.status}
            </Badge>

            <div className="flex items-center gap-3 pr-16">
              <Avatar className="h-12 w-12 rounded-lg">
                <AvatarImage
                  src={usuario.fotoUrl}
                  alt={usuario.nome}
                  className="rounded-lg"
                />
                <AvatarFallback className="rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                  {usuario.iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-medium leading-tight">
                  {usuario.nome}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {usuario.funcao}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t pt-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Setor</span>
                <span className="truncate font-medium">
                  {usuario.setor}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">E-mail</span>
                <span className="truncate text-muted-foreground">
                  {usuario.email}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
