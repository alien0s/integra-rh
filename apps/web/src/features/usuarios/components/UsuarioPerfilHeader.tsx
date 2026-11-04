import { Eye, EyeOff, Pencil, UserShield } from 'lucide-react'

import { AvatarUploader } from '@/components/RH'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
  /** Remove a foto atual. */
  onRemoverAvatar: () => Promise<void> | void
  /** Abre o modal de edição. */
  onEditar: () => void
  /**
   * Exibe o botão de editar — ver `podeEditarUsuario`
   * (features/usuarios/lib/permissoes.ts): nunca sobre o próprio usuário
   * logado, e só pra papéis liberados (hoje só ADMIN).
   */
  podeEditar: boolean
  /** Exibe o botão de personificar. */
  podePersonificar: boolean
  /** Inicia a personificação. */
  onPersonificar: () => void
  /** Exibe o botão de mostrar/ocultar dados sensíveis (só se o perfil tiver algum). */
  exibirToggleSensivel: boolean
  /** Dados sensíveis (telefone, CPF, PIS, conta, salário) visíveis em vez de "••••••". */
  mostrarSensivel: boolean
  /** Alterna `mostrarSensivel`. */
  onToggleMostrarSensivel: () => void
}

/**
 * Cabeçalho do perfil: foto (com upload), nome/função/setor, badge de
 * status e ações (Personificar/Editar) à direita.
 */
export function UsuarioPerfilHeader({
  usuario,
  onUploadAvatar,
  onRemoverAvatar,
  onEditar,
  podeEditar,
  podePersonificar,
  onPersonificar,
  exibirToggleSensivel,
  mostrarSensivel,
  onToggleMostrarSensivel,
}: UsuarioPerfilHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        <AvatarUploader
          src={usuario.fotoUrl}
          nome={usuario.nome}
          iniciais={usuario.iniciais}
          className="h-24 w-24"
          withActions
          onUpload={onUploadAvatar}
          onRemove={onRemoverAvatar}
        />
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold leading-tight">{usuario.nome}</h2>
          <p className="text-sm text-muted-foreground">
            {usuario.funcao} • {usuario.setor}
          </p>
          <Badge
            variant="outline"
            className={`mt-1 w-fit justify-center rounded-lg px-2 py-1 text-xs font-medium shadow-none ${statusClassName[usuario.status]}`}
          >
            {usuario.status}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end">
        {exibirToggleSensivel && (
          <Tooltip>
            <TooltipTrigger>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={onToggleMostrarSensivel}
              >
                {mostrarSensivel ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {mostrarSensivel ? 'Ocultar dados sensíveis' : 'Mostrar dados sensíveis'}
            </TooltipContent>
          </Tooltip>
        )}
        {podePersonificar && (
          <Button variant="outline" size="sm" onClick={onPersonificar}>
            <UserShield className="h-4 w-4" />
            Personificar
          </Button>
        )}
        {podeEditar && (
          <Button variant="outline" size="sm" onClick={onEditar}>
            <Pencil className="h-4 w-4" />
            Editar
          </Button>
        )}
      </div>
    </div>
  )
}
