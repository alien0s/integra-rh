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
  /** Campos de perfil (espelham a tabela users) — opcionais. */
  telefone?: string
  cpf?: string
  salario?: number
  dataAdmissao?: string
  dataDemissao?: string
  gestor?: string
  ultimoAcesso?: string
}

export type UsuarioTableColumn =
  | 'nome'
  | 'email'
  | 'funcao'
  | 'departamento'
  | 'status'

/** Modo de visualização da listagem de usuários. */
export type UsuarioView = 'tabela' | 'quadro' | 'lista'

/** Opção genérica id/nome para dropdowns (departamentos, funções). */
export interface OpcaoSelecao {
  id: string
  nome: string
}

/** Campos editáveis de um usuário (modal de edição). */
export interface AtualizarUsuarioInput {
  cpf: string | null
  telefone: string | null
  departamentoId: string | null
  funcaoId: string | null
}
