/** Grupos/uniões válidos para uma entidade (mesmo conjunto do CHECK no banco). */
export const GRUPOS_ENTIDADE = [
  'UNoB',
  'ANRA',
  'ACeAm',
  'Asur',
  'AAmaR',
  'MLa',
] as const

/**
 * Empresa/organização do ERP (tabela `entities`).
 */
export interface Entidade {
  id: string
  nome: string
  cnpj: string | null
  grupo: string | null
  codigoAps: number | null
  createdAt: string
}

export interface EntidadeInput {
  nome: string
  cnpj: string | null
  grupo: string | null
  codigoAps: number | null
}

/** Rascunho de edição/criação de uma entidade (campos como string, para os inputs). */
export interface EntidadeForm extends Record<string, string> {
  nome: string
  cnpj: string
  grupo: string
  codigoAps: string
}

/**
 * Setor da empresa (tabela `setor`). Só nome — sem descrição. O gestor do setor
 * é definido pelo dialog "Atribuir gerente" (tela de Usuários).
 */
export interface Setor {
  id: string
  nome: string
  createdAt: string
}

export interface SetorInput {
  nome: string
}

export interface SetorForm extends Record<string, string> {
  nome: string
}

/**
 * Função/cargo disponível na empresa (tabela `functions`).
 */
export interface Funcao {
  id: string
  nome: string
  descricao: string | null
  createdAt: string
}

export interface FuncaoInput {
  nome: string
  descricao: string | null
}

export interface FuncaoForm extends Record<string, string> {
  nome: string
  descricao: string
}

/**
 * Papel/perfil de acesso (tabela `roles`).
 */
export interface Papel {
  id: string
  codigo: string
  nome: string
  nivel: number
  createdAt: string
}

export interface PapelInput {
  codigo: string
  nome: string
  nivel: number
}

export interface PapelForm extends Record<string, string> {
  codigo: string
  nome: string
  nivel: string
}
