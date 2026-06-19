/**
 * Representa um usuário exibido na listagem de pessoas do sistema.
 */
export interface Usuario {
  id: string
  nome: string
  email: string
  funcao: string
  departamento: string
  status: 'Ativo' | 'Inativo'
  fotoUrl: string
  iniciais: string
}

export type UsuarioTableColumn =
  | 'nome'
  | 'email'
  | 'funcao'
  | 'departamento'
  | 'status'
