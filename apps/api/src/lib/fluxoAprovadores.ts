import postgres from "postgres";

import { getDatabase } from "./database.js";

/**
 * Configuração de exceções ao fluxo de aprovação de um módulo (hoje só
 * Férias) — ver migration 037_fluxo_aprovadores.sql pro desenho completo e
 * o aviso de que isto ainda NÃO é lido pelo fluxo real de decisão
 * (feriasFluxo.ts). Tabela sem RLS: controle de acesso fica na rota
 * (exigirPapeis(), ADMIN-only).
 */

export interface FluxoAprovador {
  id: string;
  modulo: string;
  etapa: string;
  grupo: string | null;
  userId: string | null;
  userNome: string | null;
  papelId: string | null;
  papelNome: string | null;
  setorIds: string[] | null;
  setorNomes: string[] | null;
}

/** Exatamente um de grupo/userId e exatamente um de papelId/setorIds (ver CHECKs da migration). */
export interface FluxoAprovadorInput {
  etapa: string;
  grupo?: string | null;
  userId?: string | null;
  papelId?: string | null;
  setorIds?: string[] | null;
}

export class FluxoAprovadorInvalidoError extends Error {}

/**
 * `null` vira NULL; lista vira "id1,id2" — uuids nunca têm vírgula, então
 * dá pra remontar o array do lado do Postgres com
 * `string_to_array(..., ',')::uuid[]` (inclusive `string_to_array(NULL, ',')`
 * já retorna NULL sozinho, sem precisar de CASE). Evita de propósito
 * `sql.array()`: nesta versão do postgres.js ele não promove de forma
 * confiável o parâmetro pro oid de array (uuid escalar vs uuid[] na mesma
 * query multi-coluna), então um CSV + string_to_array do lado do SQL é mais
 * simples e robusto que lutar com o OID do tipo.
 */
function paraSetorIdsCsv(setorIds: string[] | null | undefined): string | null {
  return setorIds && setorIds.length > 0 ? setorIds.join(",") : null;
}

function validarInput(input: FluxoAprovadorInput): void {
  const temGrupo = Boolean(input.grupo);
  const temUsuario = Boolean(input.userId);
  if (temGrupo === temUsuario) {
    throw new FluxoAprovadorInvalidoError(
      "Informe um grupo de entidade OU um usuário específico — nunca os dois, nunca nenhum.",
    );
  }
  const temPapel = Boolean(input.papelId);
  const temSetores = Boolean(input.setorIds && input.setorIds.length > 0);
  if (temPapel === temSetores) {
    throw new FluxoAprovadorInvalidoError(
      "Informe um papel responsável OU um ou mais setores — nunca os dois, nunca nenhum.",
    );
  }
}

const SELECT_FLUXO_APROVADOR = (sql: ReturnType<typeof postgres>) => sql`
  SELECT f.id, f.modulo, f.etapa, f.grupo,
         f.user_id AS "userId", u.nome AS "userNome",
         f.papel_id AS "papelId", r.nome AS "papelNome",
         f.setor_ids AS "setorIds",
         (SELECT array_agg(s.nome ORDER BY s.nome) FROM setor s WHERE s.id = ANY(f.setor_ids)) AS "setorNomes"
  FROM fluxo_aprovadores f
  LEFT JOIN users u ON u.id = f.user_id
  LEFT JOIN roles r ON r.id = f.papel_id
`;

export async function listFluxoAprovadores(modulo: string): Promise<FluxoAprovador[]> {
  const sql = getDatabase();
  return sql<FluxoAprovador[]>`
    ${SELECT_FLUXO_APROVADOR(sql)} WHERE f.modulo = ${modulo} ORDER BY f.etapa, u.nome, f.grupo
  `;
}

export async function criarFluxoAprovador(
  modulo: string,
  input: FluxoAprovadorInput,
): Promise<FluxoAprovador> {
  validarInput(input);
  const sql = getDatabase();
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO fluxo_aprovadores (modulo, etapa, grupo, user_id, papel_id, setor_ids)
    VALUES (
      ${modulo}, ${input.etapa}, ${input.grupo ?? null}, ${input.userId ?? null},
      ${input.papelId ?? null},
      string_to_array(${paraSetorIdsCsv(input.setorIds)}, ',')::uuid[]
    )
    RETURNING id
  `;
  const [fluxo] = await sql<FluxoAprovador[]>`
    ${SELECT_FLUXO_APROVADOR(sql)} WHERE f.id = ${created.id}
  `;
  return fluxo;
}

export async function atualizarFluxoAprovador(
  id: string,
  input: FluxoAprovadorInput,
): Promise<FluxoAprovador | null> {
  validarInput(input);
  const sql = getDatabase();
  const updated = await sql`
    UPDATE fluxo_aprovadores
    SET etapa = ${input.etapa}, grupo = ${input.grupo ?? null}, user_id = ${input.userId ?? null},
        papel_id = ${input.papelId ?? null},
        setor_ids = string_to_array(${paraSetorIdsCsv(input.setorIds)}, ',')::uuid[]
    WHERE id = ${id}
  `;
  if (updated.count === 0) return null;

  const [fluxo] = await sql<FluxoAprovador[]>`
    ${SELECT_FLUXO_APROVADOR(sql)} WHERE f.id = ${id}
  `;
  return fluxo;
}

export async function excluirFluxoAprovador(id: string): Promise<boolean> {
  const sql = getDatabase();
  const deleted = await sql`DELETE FROM fluxo_aprovadores WHERE id = ${id}`;
  return deleted.count > 0;
}
