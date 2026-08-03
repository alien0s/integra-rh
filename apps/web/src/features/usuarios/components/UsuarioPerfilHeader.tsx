import { Pencil, UserShield } from 'lucide-react'

import { AvatarUploader } from '@/components/RH'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Usuario } from '@/features/usuarios/types'

/** Classes do badge de status por estado do usuário. */
const statusClassName: Record<Usuario['status'], string> = {
  Ativo: 'border-transparent bg-emerald-100 text-emerald-600 hover:bg-emerald-100',
  Inativo: 'border-transparent bg-red-50 text-red-500 hover:bg-red-50',
}

interface UsuarioPerfilHeaderProps {
  usuario: Usuario
  /** Upload de nova foto (Blob recortado). */
  onUploadAvatar: (blob: Blob) => Promise<void> | void
  /** Abre o modal de edição. */
  onEditar: () => void
  /** Exibe o botão de personificar. */
  podePersonificar: boolean
  /** Inicia a personificação. */
  onPersonificar: () => void
}

/**
 * Cabeçalho do perfil: foto (com upload), nome/função/departamento, badge de
 * status e ações (Personificar/Editar) à direita.
 */
export function UsuarioPerfilHeader({
  usuario,
  onUploadAvatar,
  onEditar,
  podePersonificar,
  onPersonificar,
}: UsuarioPerfilHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <AvatarUploader
          src={usuario.fotoUrl}
          nome={usuario.nome}
          iniciais={usuario.iniciais}
          className="h-24 w-24"
          onUpload={onUploadAvatar}
        />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-semibold leading-tight">{usuario.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {usuario.funcao} • {usuario.departamento}
          </p>
          <Badge
            variant="outline"
            className={`mt-1 w-fit justify-center rounded-lg px-2 py-1 text-xs font-medium shadow-none ${statusClassName[usuario.status]}`}
          >
            {usuario.status}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 self-center">
        {podePersonificar && (
          <Button variant="outline" size="sm" onClick={onPersonificar}>
            <UserShield className="h-4 w-4" />
            Personificar
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onEditar}>
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      </div>
    </div>
  )
}
