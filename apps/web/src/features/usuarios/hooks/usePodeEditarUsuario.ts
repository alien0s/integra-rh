import { useAuthUser } from '@/features/auth/hooks'
import { podeEditarUsuario } from '@/features/usuarios/lib/permissoes'
import type { Usuario } from '@/features/usuarios/types'

/**
 * Se o usuário logado pode abrir o modal de edição completa (fora do modo
 * `apenasContato`) sobre `usuarioAlvo` — ver a regra em `podeEditarUsuario`
 * (features/usuarios/lib/permissoes.ts).
 */
export function usePodeEditarUsuario(usuarioAlvo: Usuario | null | undefined): boolean {
  const usuarioLogado = useAuthUser()
  return podeEditarUsuario(usuarioLogado, usuarioAlvo)
}
