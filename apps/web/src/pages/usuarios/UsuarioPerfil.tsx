import { useParams } from 'react-router-dom'

import { UsuarioPerfilConteudo } from './UsuarioPerfilConteudo'

/**
 * Página de perfil de um usuário (visto por outra pessoa — RH/DP/gestor;
 * COLABORADOR não acessa esta rota, ver RequireNaoColaborador). O próprio
 * usuário logado usa /meu-perfil (MeuPerfil.tsx) — mesmo conteúdo, só muda
 * o breadcrumb.
 */
export function UsuarioPerfil() {
  const { usuarioId } = useParams()

  return (
    <UsuarioPerfilConteudo
      usuarioId={usuarioId}
      breadcrumbBase={[{ label: 'Usuários', href: '/usuarios' }]}
    />
  )
}
