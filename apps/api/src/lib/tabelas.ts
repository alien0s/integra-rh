import postgres from 'postgres';

import { getDatabase, setarIdentidadeNaTransacao } from './database.js';
import type { AuthUser } from '../types/auth.js';

/* ──────────────────────────────────────────────────────────────────────────
 * Tabelas de apoio (tela /tabelas) — CRUD completo de entities, setor,
 * functions e roles. Diferente de listSetores/listFuncoes (que só
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
 * Obs.: `setor` é INDEPENDENTE de entidade (não usa isto).
 */
async function resolverEntidadeUnica(sql: ReturnType<typeof postgres>): Promise<string> {
  const [entidade] = await sql<{ id: string }[]>`
    SELECT id FROM entities ORDER BY created_at LIMIT 1
  `;
  if (!entidade) {
    throw new Error(
      'Nenhuma entidade cadastrada. Cadastre uma entidade antes de criar setores ou funções.',
    );
  }
  return entidade.id;
}

/* ── Setores (setor) ────────────────────────────────────────────────────── */

export interface Setor {
  id: string;
  nome: string;
  gestorId: string | null;
  gestorNome: string | null;
  managerId: string | null;
  managerNome: string | null;
  createdAt: string;
}

export interface SetorInput {
  nome: string;
  /** Omitido mantém o gerente atual; null remove o vínculo. */
  gestorId?: string | null;
  /** Coordenador do setor; omitido mantém, null remove. */
  managerId?: string | null;
}

export class GerenteSetorInvalidoError extends Error {}

const SELECT_SETOR = (sql: ReturnType<typeof postgres>) => sql`
  SELECT s.id, s.nome, s.gestor_id AS "gestorId", g.nome AS "gestorNome",
         (to_jsonb(s)->>'manager_id')::uuid AS "managerId", c.nome AS "managerNome",
         to_char(s.created_at, 'DD/MM/YYYY HH24:MI') AS "createdAt"
  FROM setor s
  LEFT JOIN users g ON g.id = s.gestor_id
  LEFT JOIN users c ON c.id = (to_jsonb(s)->>'manager_id')::uuid
`;

export async function listSetoresCompleto(): Promise<Setor[]> {
  const sql = getDatabase();
  return sql<Setor[]>`${SELECT_SETOR(sql)} ORDER BY s.nome`;
}

/** Usa a mesma transação do setor para que vínculo e papel sejam salvos juntos. */
async function definirPapelGerente(sql: postgres.TransactionSql, gestorId: string): Promise<void> {
  const [papel] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE codigo = 'GESTOR' FOR SHARE
  `;
  if (!papel) {
    throw new GerenteSetorInvalidoError('O papel Departamental / Gerente não está cadastrado.');
  }
  const usuario = await sql`
    UPDATE users SET role_id = ${papel.id} WHERE id = ${gestorId}
  `;
  if (usuario.count === 0) {
    throw new GerenteSetorInvalidoError('O usuário selecionado como gerente não foi encontrado.');
  }
}

/** Coordenador mantém seu papel; não promove usuários ao cadastrar a chefia. */
async function validarCoordenador(sql: postgres.TransactionSql, managerId: string | null, gestorId: string | null): Promise<void> {
  if (!managerId) return;
  if (managerId === gestorId) throw new GerenteSetorInvalidoError('Coordenador e gerente devem ser pessoas diferentes, pois possuem papéis distintos.');
  const [usuario] = await sql`SELECT id FROM users WHERE id = ${managerId} AND is_active = TRUE FOR SHARE`;
  if (!usuario) throw new GerenteSetorInvalidoError('O coordenador selecionado não foi encontrado ou está inativo.');
}

export async function criarSetor(input: SetorInput, ator: Pick<AuthUser, 'id' | 'papelCodigo'>): Promise<Setor> {
  const sql = getDatabase();
  return await sql.begin(async (tx) => {
    await setarIdentidadeNaTransacao(tx, ator);
    await validarCoordenador(tx, input.managerId ?? null, input.gestorId ?? null);
    if (input.gestorId) await definirPapelGerente(tx, input.gestorId);
    const [created] = await tx<{ id: string }[]>`
      INSERT INTO setor (nome, gestor_id, manager_id)
      VALUES (${input.nome}, ${input.gestorId ?? null}, ${input.managerId ?? null})
      RETURNING id
    `;
    const [setor] = await tx<Setor[]>`
      ${SELECT_SETOR(sql)} WHERE s.id = ${created.id}
    `;
    return setor;
  }) as unknown as Setor;
}

export async function atualizarSetor(
  id: string,
  input: SetorInput,
  ator: Pick<AuthUser, 'id' | 'papelCodigo'>,
): Promise<Setor | null> {
  const sql = getDatabase();
  return await sql.begin(async (tx) => {
    await setarIdentidadeNaTransacao(tx, ator);
    const [atual] = await tx<{ gestorId: string | null; managerId: string | null }[]>`
      SELECT gestor_id AS "gestorId", manager_id AS "managerId" FROM setor WHERE id = ${id} FOR UPDATE
    `;
    if (!atual) return null;
    const gestorId = input.gestorId === undefined ? atual.gestorId : input.gestorId;
    const managerId = input.managerId === undefined ? atual.managerId : input.managerId;
    await validarCoordenador(tx, managerId, gestorId);
    if (gestorId) await definirPapelGerente(tx, gestorId);
    await tx`
      UPDATE setor SET nome = ${input.nome}, gestor_id = ${gestorId}, manager_id = ${managerId}
      WHERE id = ${id}
    `;
    const [setor] = await tx<Setor[]>`
      ${SELECT_SETOR(sql)} WHERE s.id = ${id}
    `;
    return setor;
  }) as unknown as Setor | null;
}

export async function excluirSetor(id: string): Promise<boolean> {
  const sql = getDatabase();
  const deleted = await sql`DELETE FROM setor WHERE id = ${id}`;
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
