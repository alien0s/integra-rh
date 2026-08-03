import { useNavigate } from 'react-router-dom'

import { useAuthUser } from '@/features/auth/hooks'
import { usePersonificacao } from '@/features/auth/context'
import type { Usuario } from '@/features/usuarios/types'

/**
 * Lógica de personificação a partir de um usuário do perfil.
 * Expõe se a ação é permitida (não é você mesmo nem quem já está ativo) e a
 * ação que inicia a personificação e navega para a home.
 */
export function usePersonificar(usuario: Usuario | null | undefined) {
  const navigate = useNavigate()
  const usuarioLogado = useAuthUser()
  const { personificado, personificar } = usePersonificacao()

  const podePersonificar =
    Boolean(usuario && usuarioLogado) &&
    usuario?.id !== usuarioLogado?.id &&
    usuario?.id !== personificado?.id

  function iniciarPersonificacao() {
    if (!usuario) return
    personificar({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      avatarUrl: usuario.fotoUrl || undefined,
      iniciais: usuario.iniciais,
    })
    navigate('/home')
  }

  return { podePersonificar, personificar: iniciarPersonificacao }
}
