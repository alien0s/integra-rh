/**
 * Papéis que podem abrir o modal de edição completa de outro usuário
 * (EditarUsuarioModal, fora do modo `apenasContato`). Por enquanto só
 * ADMIN — a ideia é ir adicionando papéis aqui conforme o RH for definindo
 * quem mais edita cadastro de gente (ex.: 'RH', 'DP'). Nenhuma outra
 * mudança é necessária pra liberar um papel novo: tanto UsuariosTable.tsx
 * quanto UsuarioPerfilConteudo.tsx (via usePodeEditarUsuario) leem esta
 * mesma constante.
 *
 * ATENÇÃO — isso é só visibilidade (UI): o endpoint
 * `PATCH /usuarios/:usuarioId` (apps/api/src/routes/usuarios.routes.ts) hoje
 * só bloqueia COLABORADOR (`bloquearColaborador`) e NÃO impede um usuário de
 * editar o próprio cadastro nem restringe por papel — ou seja, esconder o
 * botão aqui não fecha a rota pra quem souber chamar a API direto. Se/quando
 * essa regra precisar valer de verdade (não só na tela), replicar a mesma
 * checagem (papel liberado + não-é-você-mesmo) no backend, no mesmo
 * espírito de `exigirPapeis` (apps/api/src/plugins/auth.ts).
 */
const PAPEIS_QUE_PODEM_EDITAR_USUARIO = new Set(['ADMIN'])

/**
 * Decide se `usuarioLogado` pode abrir o modal de edição completa sobre
 * `usuarioAlvo`:
 *   - Nunca sobre si mesmo — o próprio dono da conta não edita seu próprio
 *     cadastro (entidade/setor/função/papel) por aqui. Auto-edição de
 *     contato (cpf/telefone) continua existindo à parte, em "Meu perfil"
 *     (ver `apenasContato` em EditarUsuarioModal.tsx/UsuarioPerfilConteudo.tsx)
 *     — essa função não decide nada sobre esse outro fluxo.
 *   - Só quando o papel do usuário logado está em
 *     `PAPEIS_QUE_PODEM_EDITAR_USUARIO`.
 */
export function podeEditarUsuario(
  usuarioLogado: { id: string; papelCodigo?: string } | null | undefined,
  usuarioAlvo: { id: string } | null | undefined,
): boolean {
  if (!usuarioLogado || !usuarioAlvo) return false
  if (usuarioLogado.id === usuarioAlvo.id) return false
  return Boolean(
    usuarioLogado.papelCodigo && PAPEIS_QUE_PODEM_EDITAR_USUARIO.has(usuarioLogado.papelCodigo),
  )
}
