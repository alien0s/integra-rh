import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuthUser } from '@/features/auth/hooks'
import { usePersonificacao } from '@/features/auth/context'
import type { Usuario } from '@/features/usuarios/types'

/** Papéis com permissão para personificar outro usuário (espelha a API). */
const PAPEIS_QUE_PODEM_PERSONIFICAR = new Set(['ADMIN', 'RH'])

/**
 * Lógica de personificação a partir de um usuário do perfil.
 * Expõe se a ação é permitida (papel do usuário logado, não é você mesmo, não
 * há personificação em andamento) e a ação que inicia e navega para a home.
 */
export function usePersonificar(usuario: Usuario | null | undefined) {
  const navigate = useNavigate()
  const usuarioLogado = useAuthUser()
  const { ativo, personificar, erro } = usePersonificacao()
  const [carregando, setCarregando] = useState(false)

  const podePersonificar =
    Boolean(usuario && usuarioLogado) &&
    !ativo &&
    usuario?.id !== usuarioLogado?.id &&
    Boolean(usuarioLogado?.papelCodigo && PAPEIS_QUE_PODEM_PERSONIFICAR.has(usuarioLogado.papelCodigo))

  async function iniciarPersonificacao() {
    if (!usuario) return
    setCarregando(true)
    try {
      await personificar(usuario.id)
      navigate('/home')
    } catch {
      // Erro já fica disponível em `erro` (context) para a tela exibir.
    } finally {
      setCarregando(false)
    }
  }

  return { podePersonificar, personificar: iniciarPersonificacao, carregando, erro }
}
