import postgres from 'postgres';

import { getDatabase } from './database.js';

/* ──────────────────────────────────────────────────────────────────────────
 * Tabelas de apoio (tela /tabelas) — CRUD completo de entities, departments,
 * functions e roles. Diferente de listDepartamentos/listFuncoes (que só
 * trazem id/nome para os dropdowns de outras telas), aqui expomos o
 * registro completo para a tela administrativa de manutenção dessas
 * tabelas de apoio do ERP.
 * ────────────────────────────────────────────────────────────────────────── */

/* ── Entidades (entities) ──────────────────────────────────────────────── */

/** Grupos/uniões válidos para uma entidade (mesmo conjunto do CHECK no banco). */
export const GRUPOS_ENTIDADE = [
  "UNoB",
  "ANRA",
  "ACeAm",
  "Asur",
  "AAmaR",
  "MLa",
] as const;

export interface Entidade {
  id: string;
  nome: string;
  cnpj: string | null;
  grupo: string | null;
  codigoAps: number | null;
  createdAt: string;
}

export interface EntidadeInput {
  nome: string;
  cnpj: string | null;
  grupo: string | null;
  codigoAps: number | null;
}

const SELECT_ENTIDADE = (sql: ReturnType<typeof postgres>) => sql`
  SELECT id, nome, cnpj, grupo, codigo_aps AS "codigoAps",
         to_char(created_at, 'DD/MM/YYYY HH24:MI') AS "createdAt"
  FROM entities
`;

export async function listEntidades(): Promise<Entidade[]> {
  const sql = getDatabase();
  return sql<Entidade[]>`${SELECT_ENTIDADE(sql)} ORDER BY nome`;
}

export async function criarEntidade(input: EntidadeInput): Promise<Entidade> {
  const sql = getDatabase();
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO entities (nome, cnpj, grupo, codigo_aps)
    VALUES (${input.nome}, ${input.cnpj}, ${input.grupo}, ${input.codigoAps})
    RETURNING id
  `;
  const [entidade] = await sql<Entidade[]>`
    ${SELECT_ENTIDADE(sql)} WHERE id = ${created.id}
  `;
  return entidade;
}

export async function atualizarEntidade(
  id: string,
  input: EntidadeInput,
): Promise<Entidade | null> {
  const sql = getDatabase();
  const updated = await sql`
    UPDATE entities
    SET nome = ${input.nome}, cnpj = ${input.cnpj}, grupo = ${input.grupo},
        codigo_aps = ${input.codigoAps}
    WHERE id = ${id}
  `;
  if (updated.count === 0) return null;

  const [entidade] = await sql<Entidade[]>`
    ${SELECT_ENTIDADE(sql)} WHERE id = ${id}
  `;
  return entidade;
}

export async function excluirEntidade(id: string): Promise<boolean> {
  const sql = getDatabase();
  const deleted = await sql`DELETE FROM entities WHERE id = ${id}`;
  return deleted.count > 0;
}

/**
 * Resolve a entidade a usar em `functions` (que são de uma única entidade neste
 * ERP hoje e a tela de Tabelas não expõe a entidade). Usa a mais antiga.
 * Obs.: `departments` são INDEPENDENTES de entidade (não usam isto).
 */
async function resolverEntidadeUnica(sql: ReturnType<typeof postgres>): Promise<string> {
  const [entidade] = await sql<{ id: string }[]>`
    SELECT id FROM entities ORDER BY created_at LIMIT 1
  `;
  if (!entidade) {
    throw new Error(
      'Nenhuma entidade cadastrada. Cadastre uma entidade antes de criar departamentos ou funções.',
    );
  }
  return entidade.id;
}

/* ── Departamentos (departments) ───────────────────────────────────────── */

export interface Departamento {
  id: string;
  nome: string;
  descricao: string | null;
  createdAt: string;
}

export interface DepartamentoInput {
  nome: string;
  descricao: string | null;
}

const SELECT_DEPARTAMENTO = (sql: ReturnType<typeof postgres>) => sql`
  SELECT d.id, d.nome, d.descricao, to_char(d.created_at, 'DD/MM/YYYY HH24:MI') AS "createdAt"
  FROM departments d
`;

export async function listDepartamentosCompleto(): Promise<Departamento[]> {
  const sql = getDatabase();
  return sql<Departamento[]>`${SELECT_DEPARTAMENTO(sql)} ORDER BY d.nome`;
}

export async function criarDepartamento(
  input: DepartamentoInput,
): Promise<Departamento> {
  const sql = getDatabase();
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO departments (nome, descricao)
    VALUES (${input.nome}, ${input.descricao})
    RETURNING id
  `;
  const [departamento] = await sql<Departamento[]>`
    ${SELECT_DEPARTAMENTO(sql)} WHERE d.id = ${created.id}
  `;
  return departamento;
}

export async function atualizarDepartamento(
  id: string,
  input: DepartamentoInput,
): Promise<Departamento | null> {
  const sql = getDatabase();
  const updated = await sql`
    UPDATE departments SET nome = ${input.nome}, descricao = ${input.descricao}
    WHERE id = ${id}
  `;
  if (updated.count === 0) return null;

  const [departamento] = await sql<Departamento[]>`
    ${SELECT_DEPARTAMENTO(sql)} WHERE d.id = ${id}
  `;
  return departamento;
}

export async function excluirDepartamento(id: string): Promise<boolean> {
  const sql = getDatabase();
  const deleted = await sql`DELETE FROM departments WHERE id = ${id}`;
  return deleted.count > 0;
}

/* ── Funções (functions) ───────────────────────────────────────────────── */

export interface Funcao {
  id: string;
  nome: string;
  descricao: string | null;
  createdAt: string;
}

export interface FuncaoInput {
  nome: string;
  descricao: string | null;
}

const SELECT_FUNCAO = (sql: ReturnType<typeof postgres>) => sql`
  SELECT f.id, f.nome, f.descricao, to_char(f.created_at, 'DD/MM/YYYY HH24:MI') AS "createdAt"
  FROM functions f
`;

export async function listFuncoesCompleto(): Promise<Funcao[]> {
  const sql = getDatabase();
  return sql<Funcao[]>`${SELECT_FUNCAO(sql)} ORDER BY f.nome`;
}

export async function criarFuncao(input: FuncaoInput): Promise<Funcao> {
  const sql = getDatabase();
  const entityId = await resolverEntidadeUnica(sql);
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO functions (entity_id, nome, descricao)
    VALUES (${entityId}, ${input.nome}, ${input.descricao})
    RETURNING id
  `;
  const [funcao] = await sql<Funcao[]>`
    ${SELECT_FUNCAO(sql)} WHERE f.id = ${created.id}
  `;
  return funcao;
}

export async function atualizarFuncao(
  id: string,
  input: FuncaoInput,
): Promise<Funcao | null> {
  const sql = getDatabase();
  const updated = await sql`
    UPDATE functions SET nome = ${input.nome}, descricao = ${input.descricao}
    WHERE id = ${id}
  `;
  if (updated.count === 0) return null;

  const [funcao] = await sql<Funcao[]>`
    ${SELECT_FUNCAO(sql)} WHERE f.id = ${id}
  `;
  return funcao;
}

export async function excluirFuncao(id: string): Promise<boolean> {
  const sql = getDatabase();
  const deleted = await sql`DELETE FROM functions WHERE id = ${id}`;
  return deleted.count > 0;
}

/* ── Papéis (roles) ────────────────────────────────────────────────────── */

export interface Papel {
  id: string;
  codigo: string;
  nome: string;
  nivel: number;
  createdAt: string;
}

export interface PapelInput {
  codigo: string;
  nome: string;
  nivel: number;
}

const SELECT_PAPEL = (sql: ReturnType<typeof postgres>) => sql`
  SELECT id, codigo, nome, nivel, to_char(created_at, 'DD/MM/YYYY HH24:MI') AS "createdAt"
  FROM roles
`;

export async function listPapeis(): Promise<Papel[]> {
  const sql = getDatabase();
  return sql<Papel[]>`${SELECT_PAPEL(sql)} ORDER BY nivel DESC, nome`;
}

export async function criarPapel(input: PapelInput): Promise<Papel> {
  const sql = getDatabase();
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO roles (codigo, nome, nivel)
    VALUES (${input.codigo}, ${input.nome}, ${input.nivel})
    RETURNING id
  `;
  const [papel] = await sql<Papel[]>`
    ${SELECT_PAPEL(sql)} WHERE id = ${created.id}
  `;
  return papel;
}

export async function atualizarPapel(
  id: string,
  input: PapelInput,
): Promise<Papel | null> {
  const sql = getDatabase();
  const updated = await sql`
    UPDATE roles SET codigo = ${input.codigo}, nome = ${input.nome}, nivel = ${input.nivel}
    WHERE id = ${id}
  `;
  if (updated.count === 0) return null;

  const [papel] = await sql<Papel[]>`
    ${SELECT_PAPEL(sql)} WHERE id = ${id}
  `;
  return papel;
}

export async function excluirPapel(id: string): Promise<boolean> {
  const sql = getDatabase();
  const deleted = await sql`DELETE FROM roles WHERE id = ${id}`;
  return deleted.count > 0;
}
