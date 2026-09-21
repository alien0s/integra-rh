import postgres from "postgres";

import { getDatabase } from "./database.js";
import { listarFeriadosLegado } from "./mssql.js";

/**
 * Feriados (tabela `feriados`) definidos pelo DP. Usados para limitar o
 * calendário de férias (o início não pode cair num feriado). Podem ser
 * cadastrados manualmente, importados dos nacionais via BrasilAPI, ou
 * importados dos municipais/estaduais do legado (APS).
 */

export type TipoFeriado = "NACIONAL" | "ESTADUAL" | "MUNICIPAL" | "FACULTATIVO";
export type FonteFeriado = "MANUAL" | "BRASILAPI" | "APS";

export interface FeriadoDTO {
  id: string;
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: TipoFeriado;
  ano: number;
  fonte: FonteFeriado;
}

export interface CriarFeriadoInput {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo?: TipoFeriado;
}

export interface AtualizarFeriadoInput {
  data?: string;
  nome?: string;
  tipo?: TipoFeriado;
}

/** Erro de regra (ex.: feriado duplicado). A rota converte em 400/409. */
export class FeriadoInvalidoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeriadoInvalidoError";
  }
}

/** Colunas do DTO (fragmento reusável, como em ferias.ts). */
const COLS_FERIADO = (sql: ReturnType<typeof postgres>) =>
  sql`id, to_char(data, 'YYYY-MM-DD') AS data, nome, tipo, ano, fonte`;

/** Ano (INTEGER) a partir de "YYYY-MM-DD". */
function anoDeISO(iso: string): number {
  return Number(iso.slice(0, 4));
}

/** Lista feriados, opcionalmente filtrando por ano, ordenados por data. */
export async function listFeriados(ano?: number): Promise<FeriadoDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<FeriadoDTO[]>`
    SELECT ${COLS_FERIADO(sql)} FROM feriados
    ${ano ? sql`WHERE ano = ${ano}` : sql``}
    ORDER BY data ASC
  `;
  return linhas;
}

/** Cria um feriado (fonte MANUAL). Rejeita data duplicada. */
export async function criarFeriado(input: CriarFeriadoInput): Promise<FeriadoDTO> {
  const sql = getDatabase();

  const [existe] = await sql<{ id: string }[]>`
    SELECT id FROM feriados WHERE data = ${input.data} LIMIT 1
  `;
  if (existe) {
    throw new FeriadoInvalidoError("Já existe um feriado cadastrado nesta data.");
  }

  const [criado] = await sql<FeriadoDTO[]>`
    INSERT INTO feriados (data, nome, tipo, ano, fonte)
    VALUES (
      ${input.data}, ${input.nome}, ${input.tipo ?? "NACIONAL"},
      ${anoDeISO(input.data)}, 'MANUAL'
    )
    RETURNING ${COLS_FERIADO(sql)}
  `;
  return criado;
}

/** Atualiza data/nome/tipo de um feriado. Retorna null se não existir. */
export async function atualizarFeriado(
  id: string,
  input: AtualizarFeriadoInput,
): Promise<FeriadoDTO | null> {
  const sql = getDatabase();

  const [atual] = await sql<FeriadoDTO[]>`
    SELECT ${COLS_FERIADO(sql)} FROM feriados WHERE id = ${id} LIMIT 1
  `;
  if (!atual) return null;

  const data = input.data ?? atual.data;
  const nome = input.nome ?? atual.nome;
  const tipo = input.tipo ?? atual.tipo;

  // Se mudou a data, garantir que não colide com outro feriado.
  if (data !== atual.data) {
    const [colide] = await sql<{ id: string }[]>`
      SELECT id FROM feriados WHERE data = ${data} AND id <> ${id} LIMIT 1
    `;
    if (colide) {
      throw new FeriadoInvalidoError("Já existe um feriado cadastrado nesta data.");
    }
  }

  const [atualizado] = await sql<FeriadoDTO[]>`
    UPDATE feriados
    SET data = ${data}, nome = ${nome}, tipo = ${tipo}, ano = ${anoDeISO(data)}
    WHERE id = ${id}
    RETURNING ${COLS_FERIADO(sql)}
  `;
  return atualizado ?? null;
}

/** Exclui um feriado. Retorna true se removeu. */
export async function excluirFeriado(id: string): Promise<boolean> {
  const sql = getDatabase();
  const removido = await sql`DELETE FROM feriados WHERE id = ${id}`;
  return removido.count > 0;
}

/**
 * Exclui TODOS os feriados de um ano (manuais e importados). Usado pelo botão
 * "N feriado(s)" na tela do DP, para zerar o ano antes de reimportar. Retorna
 * quantos foram removidos (0 se o ano já estava vazio).
 */
export async function excluirFeriadosPorAno(ano: number): Promise<number> {
  const sql = getDatabase();
  const removidos = await sql`DELETE FROM feriados WHERE ano = ${ano}`;
  return removidos.count;
}

/** Item retornado pela BrasilAPI (/feriados/v1/{ano}). */
interface FeriadoBrasilAPI {
  date: string; // YYYY-MM-DD
  name: string;
  type: string; // "national"
}

/**
 * Importa os feriados NACIONAIS de um ano da BrasilAPI. Idempotente
 * (ON CONFLICT (data) DO NOTHING). Retorna quantos foram inseridos e o total
 * retornado pela API. Degrada com erro amigável se a API falhar/estiver fora.
 */
export async function importarFeriadosNacionais(
  ano: number,
): Promise<{ inseridos: number; total: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let feriados: FeriadoBrasilAPI[];
  try {
    const resp = await fetch(
      `https://brasilapi.com.br/api/feriados/v1/${ano}`,
      { signal: controller.signal },
    );
    if (!resp.ok) {
      throw new FeriadoInvalidoError(
        `Não foi possível obter os feriados de ${ano} (BrasilAPI respondeu ${resp.status}).`,
      );
    }
    feriados = (await resp.json()) as FeriadoBrasilAPI[];
  } catch (error) {
    if (error instanceof FeriadoInvalidoError) throw error;
    throw new FeriadoInvalidoError(
      "Não foi possível conectar à BrasilAPI para importar os feriados.",
    );
  } finally {
    clearTimeout(timeout);
  }

  const sql = getDatabase();
  let inseridos = 0;
  for (const f of feriados) {
    const res = await sql`
      INSERT INTO feriados (data, nome, tipo, ano, fonte)
      VALUES (${f.date}, ${f.name}, 'NACIONAL', ${anoDeISO(f.date)}, 'BRASILAPI')
      ON CONFLICT (data) DO NOTHING
    `;
    inseridos += res.count;
  }
  return { inseridos, total: feriados.length };
}

/**
 * Importa os feriados NACIONAIS/ESTADUAIS/MUNICIPAIS de um ano do legado
 * (banco APS, `Locality_Holiday`, nos 3 níveis geográficos da ACEAM) —
 * mantidos manualmente pelo DP lá todo início de ano. Idempotente (ON
 * CONFLICT (data) DO NOTHING), mesmo padrão de `importarFeriadosNacionais`
 * (não duplica um feriado nacional já importado da BrasilAPI na mesma data).
 * Deixa `MssqlIndisponivelError` propagar (a rota converte em 503) se o
 * legado estiver desabilitado/inacessível.
 */
export async function importarFeriadosLegado(
  ano: number,
): Promise<{ inseridos: number; total: number }> {
  const legado = await listarFeriadosLegado(ano);

  const sql = getDatabase();
  let inseridos = 0;
  for (const f of legado) {
    const res = await sql`
      INSERT INTO feriados (data, nome, tipo, ano, fonte)
      VALUES (${f.data}, ${f.nome}, ${f.tipo}, ${anoDeISO(f.data)}, 'APS')
      ON CONFLICT (data) DO NOTHING
    `;
    inseridos += res.count;
  }
  return { inseridos, total: legado.length };
}
