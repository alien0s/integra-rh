import { useAuth } from '@/features/auth/context'

import { UsuarioPerfilConteudo } from './UsuarioPerfilConteudo'

/**
 * Página "Meu perfil" — o mesmo conteúdo de UsuarioPerfil.tsx (perfil de
 * usuário), mas sempre sobre o PRÓPRIO usuário logado, numa rota liberada
 * pra todo mundo (inclusive COLABORADOR, que não acessa /usuarios/:id — ver
 * RequireNaoColaborador em AuthGuards.tsx). Só o breadcrumb muda.
 *
 * COLABORADOR editando o próprio perfil fica restrito a CPF/telefone
 * (`apenasContato`) — a API bloqueia PATCH /usuarios/:id pra esse papel.
 */
export function MeuPerfil() {
  const { usuario } = useAuth()

  return (
    <UsuarioPerfilConteudo
      usuarioId={usuario?.id}
      breadcrumbBase={[{ label: 'Meu perfil' }]}
      apenasContato={usuario?.papelCodigo === 'COLABORADOR'}
    />
  )
}
