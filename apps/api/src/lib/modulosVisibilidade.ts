import postgres from "postgres";

import { getDatabase } from "./database.js";

/* ──────────────────────────────────────────────────────────────────────────
 * Visibilidade de módulos (sidebar + acesso à rota) por papel — tela
 * "Tabelas" (ADMIN). Tabela esparsa (`modulos_visibilidade`, ver
 * 030_modulos_visibilidade.sql): só guarda exceções, ausência de linha para
 * um (módulo, papel) = visível. `modulo_codigo` não tem catálogo no banco —
 * o conjunto de módulos vive no front (AppSidebar.tsx, MODULOS_SIDEBAR).
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Uma exceção de visibilidade/lançamento (módulo × papel), já com o papel
 * resolvido. `visivel`: o papel vê/acessa o módulo. `liberadoAntecipado`:
 * durante o lançamento beta, esse papel já usa o módulo sem cadeado (ver
 * 031_modulos_visibilidade_liberado_antecipado.sql) — só importa pra quem já
 * é `visivel`.
 */
export interface ModuloVisibilidadeOverride {
  moduloCodigo: string;
  roleId: string;
  roleCodigo: string;
  roleNome: string;
  visivel: boolean;
  liberadoAntecipado: boolean;
}

const SELECT_OVERRIDE = (sql: ReturnType<typeof postgres>) => sql`
  SELECT
    mv.modulo_codigo       AS "moduloCodigo",
    mv.role_id             AS "roleId",
    r.codigo               AS "roleCodigo",
    r.nome                 AS "roleNome",
    mv.visivel,
    mv.liberado_antecipado AS "liberadoAntecipado"
  FROM modulos_visibilidade mv
  JOIN roles r ON r.id = mv.role_id
`;

/** Lista todas as exceções cadastradas (matriz completa da tela admin). */
export async function listModulosVisibilidade(): Promise<ModuloVisibilidadeOverride[]> {
  const sql = getDatabase();
  return sql<ModuloVisibilidadeOverride[]>`
    ${SELECT_OVERRIDE(sql)} ORDER BY mv.modulo_codigo, r.nivel DESC
  `;
}

/**
 * Define a visibilidade de um módulo para um papel (upsert — cria a exceção
 * ou corrige a já existente). Retorna null se `roleId` não existir (FK
 * 23503 — a rota trata como 404).
 */
export async function definirVisibilidade(
  moduloCodigo: string,
  roleId: string,
  visivel: boolean,
): Promise<ModuloVisibilidadeOverride | null> {
  const sql = getDatabase();

  const [role] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE id = ${roleId} LIMIT 1
  `;
  if (!role) return null;

  await sql`
    INSERT INTO modulos_visibilidade (modulo_codigo, role_id, visivel)
    VALUES (${moduloCodigo}, ${roleId}, ${visivel})
    ON CONFLICT (modulo_codigo, role_id) DO UPDATE SET visivel = EXCLUDED.visivel
  `;

  const [atualizado] = await sql<ModuloVisibilidadeOverride[]>`
    ${SELECT_OVERRIDE(sql)} WHERE mv.modulo_codigo = ${moduloCodigo} AND mv.role_id = ${roleId}
  `;
  return atualizado;
}

/**
 * Códigos de módulo NEGADOS (visivel = FALSE) para um papel — usado no login
 * para gravar `modulosRestritos` no token (ver calcularModulosRestritos em
 * auth.routes.ts). Quem chama já pula ADMIN/modo dev antes de chegar aqui
 * (mesma convenção de exigirPapeis() — ADMIN sempre livre).
 */
export async function listModulosRestritosPorPapel(papelCodigo: string): Promise<string[]> {
  const sql = getDatabase();
  const linhas = await sql<{ moduloCodigo: string }[]>`
    SELECT mv.modulo_codigo AS "moduloCodigo"
    FROM modulos_visibilidade mv
    JOIN roles r ON r.id = mv.role_id
    WHERE r.codigo = ${papelCodigo} AND mv.visivel = FALSE
  `;
  return linhas.map((l) => l.moduloCodigo);
}

/**
 * Define se um módulo está liberado antecipadamente (sem cadeado) pra um
 * papel durante o lançamento beta (upsert). Retorna null se `roleId` não
 * existir (a rota trata como 404).
 */
export async function definirLiberadoAntecipado(
  moduloCodigo: string,
  roleId: string,
  liberadoAntecipado: boolean,
): Promise<ModuloVisibilidadeOverride | null> {
  const sql = getDatabase();

  const [role] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE id = ${roleId} LIMIT 1
  `;
  if (!role) return null;

  await sql`
    INSERT INTO modulos_visibilidade (modulo_codigo, role_id, liberado_antecipado)
    VALUES (${moduloCodigo}, ${roleId}, ${liberadoAntecipado})
    ON CONFLICT (modulo_codigo, role_id) DO UPDATE SET liberado_antecipado = EXCLUDED.liberado_antecipado
  `;

  const [atualizado] = await sql<ModuloVisibilidadeOverride[]>`
    ${SELECT_OVERRIDE(sql)} WHERE mv.modulo_codigo = ${moduloCodigo} AND mv.role_id = ${roleId}
  `;
  return atualizado;
}

/**
 * Códigos de módulo liberados ANTECIPADAMENTE (sem cadeado) para um papel
 * durante o lançamento beta — usado no login para gravar
 * `modulosBetaLiberados` no token (ver calcularModulosBetaLiberados em
 * auth.routes.ts). Quem chama já pula ADMIN/modo dev (mesma convenção de
 * listModulosRestritosPorPapel acima).
 */
export async function listModulosBetaLiberadosPorPapel(papelCodigo: string): Promise<string[]> {
  const sql = getDatabase();
  const linhas = await sql<{ moduloCodigo: string }[]>`
    SELECT mv.modulo_codigo AS "moduloCodigo"
    FROM modulos_visibilidade mv
    JOIN roles r ON r.id = mv.role_id
    WHERE r.codigo = ${papelCodigo} AND mv.liberado_antecipado = TRUE
  `;
  return linhas.map((l) => l.moduloCodigo);
}
