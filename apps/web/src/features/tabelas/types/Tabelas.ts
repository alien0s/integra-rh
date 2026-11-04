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
 * Setor da empresa (tabela `setor`) e suas chefias opcionais (coordenador e gerente).
 */
export interface Setor {
  id: string
  nome: string
  gestorId: string | null
  gestorNome: string | null
  managerId: string | null
  managerNome: string | null
  createdAt: string
}

export interface SetorInput {
  nome: string
  gestorId?: string | null
  managerId?: string | null
}

export interface SetorForm extends Record<string, string> {
  nome: string
  gestorId: string
  managerId: string
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

/**
 * Exceção de visibilidade/lançamento de um módulo (sidebar + rota) para um
 * papel — tabela `modulos_visibilidade`. Ausência de uma combinação
 * (moduloCodigo, roleId) nesta lista = visível e sem cadeado (defaults) — ver
 * ModulosVisibilidadeAdmin.tsx. `liberadoAntecipado`: durante o lançamento
 * beta, esse papel já usa o módulo sem cadeado (só importa pra quem já é
 * `visivel`).
 */
export interface ModuloVisibilidade {
  moduloCodigo: string
  roleId: string
  roleCodigo: string
  roleNome: string
  visivel: boolean
  liberadoAntecipado: boolean
}
