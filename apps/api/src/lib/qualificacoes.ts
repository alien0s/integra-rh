import postgres from "postgres";

import { getDatabase } from "./database.js";

/**
 * Módulo de Cursos e Qualificações — formação acadêmica, cursos/workshops/
 * certificações e idiomas do colaborador, com aprovação do RH.
 *
 * Regra de negócio (repetida aqui de propósito): `status`/`motivoRecusa` são
 * só para a tela do RH moderar. As rotas de "visão pública" (usadas quando
 * alguém vê o perfil de outra pessoa) só devolvem registros com
 * status = 'APROVADO' e SEM o campo `status` — o front nunca deve exibir
 * "pendente"/"recusado" fora da própria lista de moderação do RH.
 */

export type StatusQualificacao = "PENDENTE" | "APROVADO" | "RECUSADO";

/**
 * Registro mínimo pra checar permissão e servir/baixar um anexo (diploma,
 * certificado). `chave` é a key no object storage (não uma URL) — só o
 * dono, RH/Admin, ou (pra leitura) qualquer um quando já está APROVADO.
 */
export interface AnexoQualificacao {
  userId: string;
  status: StatusQualificacao;
  chave: string | null;
}

/** Iniciais (primeiro + último nome) para o fallback do avatar. */
function gerarIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Resolve o avatar para uma URL exibível (mesma regra de users/ferias). */
function montarAvatarUrl(userId: string, valor: string | null): string {
  if (!valor) return "";
  if (valor.startsWith("http") || valor.startsWith("data:")) return valor;
  return `/usuarios/${userId}/avatar`;
}

/* ────────────────────────────────────────────────────────────────────────
 * Formação acadêmica
 * ──────────────────────────────────────────────────────────────────────── */

export type NivelFormacao =
  | "TECNICO"
  | "GRADUACAO"
  | "POS_GRADUACAO"
  | "MBA"
  | "MESTRADO"
  | "DOUTORADO";
export type SituacaoFormacao = "EM_ANDAMENTO" | "CONCLUIDO" | "TRANCADO";

export interface FormacaoAcademica {
  id: string;
  userId: string;
  nivel: NivelFormacao;
  curso: string;
  instituicao: string;
  anoInicio: number;
  anoFim: number | null;
  situacao: SituacaoFormacao;
  anexoUrl: string | null;
  status: StatusQualificacao;
  motivoRecusa: string | null;
}

/** Igual a FormacaoAcademica, mas sem `status`/`motivoRecusa` (visão pública). */
export type FormacaoAcademicaPublica = Omit<
  FormacaoAcademica,
  "status" | "motivoRecusa"
>;

export interface FormacaoAcademicaInput {
  nivel: NivelFormacao;
  curso: string;
  instituicao: string;
  anoInicio: number;
  anoFim: number | null;
  situacao: SituacaoFormacao;
  anexoUrl: string | null;
}

const SELECT_FORMACAO = (sql: ReturnType<typeof postgres>) => sql`
  SELECT id, user_id AS "userId", nivel, curso, instituicao,
         ano_inicio AS "anoInicio", ano_fim AS "anoFim", situacao,
         anexo_url AS "anexoUrl", status, motivo_recusa AS "motivoRecusa"
  FROM qualificacoes_academicas
`;

/** Histórico do próprio colaborador (inclui pendentes/recusadas — tela dele gerenciar). */
export async function listMinhasFormacoes(
  userId: string,
): Promise<FormacaoAcademica[]> {
  const sql = getDatabase();
  return sql<FormacaoAcademica[]>`
    ${SELECT_FORMACAO(sql)} WHERE user_id = ${userId} ORDER BY ano_inicio DESC
  `;
}

/** Visão pública (perfil de outra pessoa): só aprovadas, sem status. */
export async function listFormacoesAprovadas(
  userId: string,
): Promise<FormacaoAcademicaPublica[]> {
  const sql = getDatabase();
  const linhas = await sql<FormacaoAcademica[]>`
    ${SELECT_FORMACAO(sql)}
    WHERE user_id = ${userId} AND status = 'APROVADO'
    ORDER BY ano_inicio DESC
  `;
  return linhas.map((linha) => ({
    id: linha.id,
    userId: linha.userId,
    nivel: linha.nivel,
    curso: linha.curso,
    instituicao: linha.instituicao,
    anoInicio: linha.anoInicio,
    anoFim: linha.anoFim,
    situacao: linha.situacao,
    anexoUrl: linha.anexoUrl,
  }));
}

/** Todas as formações pendentes de aprovação (fila de moderação do RH). */
export async function listFormacoesPendentes(): Promise<FormacaoAcademica[]> {
  const sql = getDatabase();
  return sql<FormacaoAcademica[]>`
    ${SELECT_FORMACAO(sql)} WHERE status = 'PENDENTE' ORDER BY id
  `;
}

/**
 * Uma formação por id, com `status`/`motivoRecusa` (visão de moderação do
 * RH) — qualquer status, não só PENDENTE (ex.: reabrir pelo histórico de
 * notificações um item já decidido). `null` se não existir.
 */
export async function getFormacaoPorId(id: string): Promise<FormacaoAcademica | null> {
  const sql = getDatabase();
  const linhas = await sql<FormacaoAcademica[]>`
    ${SELECT_FORMACAO(sql)} WHERE id = ${id}
  `;
  return linhas[0] ?? null;
}

export async function criarFormacao(
  userId: string,
  input: FormacaoAcademicaInput,
): Promise<FormacaoAcademica> {
  const sql = getDatabase();
  const [criada] = await sql<{ id: string }[]>`
    INSERT INTO qualificacoes_academicas (
      user_id, nivel, curso, instituicao, ano_inicio, ano_fim, situacao, anexo_url
    )
    VALUES (
      ${userId}, ${input.nivel}, ${input.curso}, ${input.instituicao},
      ${input.anoInicio}, ${input.anoFim}, ${input.situacao}, ${input.anexoUrl}
    )
    RETURNING id
  `;
  const [linha] = await sql<FormacaoAcademica[]>`
    ${SELECT_FORMACAO(sql)} WHERE id = ${criada.id}
  `;
  return linha;
}

/** Exclui uma formação. `podeExcluirQualquer` = RH/Admin (senão, só o próprio dono). */
export async function excluirFormacao(
  id: string,
  userId: string,
  podeExcluirQualquer: boolean,
): Promise<boolean> {
  const sql = getDatabase();
  const deletado = podeExcluirQualquer
    ? await sql`DELETE FROM qualificacoes_academicas WHERE id = ${id}`
    : await sql`
        DELETE FROM qualificacoes_academicas WHERE id = ${id} AND user_id = ${userId}
      `;
  return deletado.count > 0;
}

/** Registro + chave do anexo (diploma), pra checar permissão antes de servir/trocar. */
export async function getAnexoFormacao(id: string): Promise<AnexoQualificacao | null> {
  const sql = getDatabase();
  const [linha] = await sql<AnexoQualificacao[]>`
    SELECT user_id AS "userId", status, anexo_url AS "chave"
    FROM qualificacoes_academicas WHERE id = ${id}
  `;
  return linha ?? null;
}

export async function salvarAnexoFormacao(
  id: string,
  userId: string,
  chave: string,
  podeQualquer: boolean,
): Promise<FormacaoAcademica | null> {
  const sql = getDatabase();
  const atualizado = podeQualquer
    ? await sql`UPDATE qualificacoes_academicas SET anexo_url = ${chave} WHERE id = ${id}`
    : await sql`
        UPDATE qualificacoes_academicas SET anexo_url = ${chave}
        WHERE id = ${id} AND user_id = ${userId}
      `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<FormacaoAcademica[]>`${SELECT_FORMACAO(sql)} WHERE id = ${id}`;
  return linha;
}

export async function removerAnexoFormacao(
  id: string,
  userId: string,
  podeQualquer: boolean,
): Promise<boolean> {
  const sql = getDatabase();
  const atualizado = podeQualquer
    ? await sql`UPDATE qualificacoes_academicas SET anexo_url = NULL WHERE id = ${id}`
    : await sql`
        UPDATE qualificacoes_academicas SET anexo_url = NULL
        WHERE id = ${id} AND user_id = ${userId}
      `;
  return atualizado.count > 0;
}

export async function aprovarFormacao(
  id: string,
  aprovadorId: string,
): Promise<FormacaoAcademica | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE qualificacoes_academicas
    SET status = 'APROVADO', aprovado_por = ${aprovadorId}, decidido_em = NOW(),
        motivo_recusa = NULL
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<FormacaoAcademica[]>`
    ${SELECT_FORMACAO(sql)} WHERE id = ${id}
  `;
  return linha;
}

export async function recusarFormacao(
  id: string,
  aprovadorId: string,
  motivo: string,
): Promise<FormacaoAcademica | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE qualificacoes_academicas
    SET status = 'RECUSADO', aprovado_por = ${aprovadorId}, decidido_em = NOW(),
        motivo_recusa = ${motivo}
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<FormacaoAcademica[]>`
    ${SELECT_FORMACAO(sql)} WHERE id = ${id}
  `;
  return linha;
}

/* ────────────────────────────────────────────────────────────────────────
 * Cursos, workshops e certificações (tabela mesclada — `tipo` diferencia)
 * ──────────────────────────────────────────────────────────────────────── */

export type TipoCursoQualificacao = "CERTIFICACAO" | "CURSO" | "WORKSHOP";

export interface CursoQualificacao {
  id: string;
  userId: string;
  tipo: TipoCursoQualificacao;
  nome: string;
  instituicao: string;
  cargaHoraria: number | null;
  dataEmissao: string | null;
  dataValidade: string | null;
  certificadoUrl: string | null;
  status: StatusQualificacao;
  motivoRecusa: string | null;
}

export type CursoQualificacaoPublico = Omit<
  CursoQualificacao,
  "status" | "motivoRecusa"
>;

export interface CursoQualificacaoInput {
  tipo: TipoCursoQualificacao;
  nome: string;
  instituicao: string;
  cargaHoraria: number | null;
  dataEmissao: string | null;
  dataValidade: string | null;
  certificadoUrl: string | null;
}

const SELECT_CURSO = (sql: ReturnType<typeof postgres>) => sql`
  SELECT id, user_id AS "userId", tipo, nome, instituicao,
         carga_horaria AS "cargaHoraria",
         to_char(data_emissao, 'YYYY-MM-DD') AS "dataEmissao",
         to_char(data_validade, 'YYYY-MM-DD') AS "dataValidade",
         certificado_url AS "certificadoUrl", status, motivo_recusa AS "motivoRecusa"
  FROM qualificacoes_cursos
`;

export async function listMeusCursos(userId: string): Promise<CursoQualificacao[]> {
  const sql = getDatabase();
  return sql<CursoQualificacao[]>`
    ${SELECT_CURSO(sql)} WHERE user_id = ${userId} ORDER BY data_emissao DESC NULLS LAST
  `;
}

export async function listCursosAprovados(
  userId: string,
): Promise<CursoQualificacaoPublico[]> {
  const sql = getDatabase();
  const linhas = await sql<CursoQualificacao[]>`
    ${SELECT_CURSO(sql)}
    WHERE user_id = ${userId} AND status = 'APROVADO'
    ORDER BY data_emissao DESC NULLS LAST
  `;
  return linhas.map((linha) => ({
    id: linha.id,
    userId: linha.userId,
    tipo: linha.tipo,
    nome: linha.nome,
    instituicao: linha.instituicao,
    cargaHoraria: linha.cargaHoraria,
    dataEmissao: linha.dataEmissao,
    dataValidade: linha.dataValidade,
    certificadoUrl: linha.certificadoUrl,
  }));
}

export async function listCursosPendentes(): Promise<CursoQualificacao[]> {
  const sql = getDatabase();
  return sql<CursoQualificacao[]>`
    ${SELECT_CURSO(sql)} WHERE status = 'PENDENTE' ORDER BY id
  `;
}

/** Um curso/workshop/certificação por id, qualquer status. `null` se não existir. */
export async function getCursoPorId(id: string): Promise<CursoQualificacao | null> {
  const sql = getDatabase();
  const linhas = await sql<CursoQualificacao[]>`
    ${SELECT_CURSO(sql)} WHERE id = ${id}
  `;
  return linhas[0] ?? null;
}

export async function criarCurso(
  userId: string,
  input: CursoQualificacaoInput,
): Promise<CursoQualificacao> {
  const sql = getDatabase();
  const [criado] = await sql<{ id: string }[]>`
    INSERT INTO qualificacoes_cursos (
      user_id, tipo, nome, instituicao, carga_horaria,
      data_emissao, data_validade, certificado_url
    )
    VALUES (
      ${userId}, ${input.tipo}, ${input.nome}, ${input.instituicao}, ${input.cargaHoraria},
      ${input.dataEmissao}, ${input.dataValidade}, ${input.certificadoUrl}
    )
    RETURNING id
  `;
  const [linha] = await sql<CursoQualificacao[]>`
    ${SELECT_CURSO(sql)} WHERE id = ${criado.id}
  `;
  return linha;
}

export async function excluirCurso(
  id: string,
  userId: string,
  podeExcluirQualquer: boolean,
): Promise<boolean> {
  const sql = getDatabase();
  const deletado = podeExcluirQualquer
    ? await sql`DELETE FROM qualificacoes_cursos WHERE id = ${id}`
    : await sql`DELETE FROM qualificacoes_cursos WHERE id = ${id} AND user_id = ${userId}`;
  return deletado.count > 0;
}

/** Registro + chave do anexo (certificado), pra checar permissão antes de servir/trocar. */
export async function getAnexoCurso(id: string): Promise<AnexoQualificacao | null> {
  const sql = getDatabase();
  const [linha] = await sql<AnexoQualificacao[]>`
    SELECT user_id AS "userId", status, certificado_url AS "chave"
    FROM qualificacoes_cursos WHERE id = ${id}
  `;
  return linha ?? null;
}

export async function salvarCertificadoCurso(
  id: string,
  userId: string,
  chave: string,
  podeQualquer: boolean,
): Promise<CursoQualificacao | null> {
  const sql = getDatabase();
  const atualizado = podeQualquer
    ? await sql`UPDATE qualificacoes_cursos SET certificado_url = ${chave} WHERE id = ${id}`
    : await sql`
        UPDATE qualificacoes_cursos SET certificado_url = ${chave}
        WHERE id = ${id} AND user_id = ${userId}
      `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<CursoQualificacao[]>`${SELECT_CURSO(sql)} WHERE id = ${id}`;
  return linha;
}

export async function removerCertificadoCurso(
  id: string,
  userId: string,
  podeQualquer: boolean,
): Promise<boolean> {
  const sql = getDatabase();
  const atualizado = podeQualquer
    ? await sql`UPDATE qualificacoes_cursos SET certificado_url = NULL WHERE id = ${id}`
    : await sql`
        UPDATE qualificacoes_cursos SET certificado_url = NULL
        WHERE id = ${id} AND user_id = ${userId}
      `;
  return atualizado.count > 0;
}

export async function aprovarCurso(
  id: string,
  aprovadorId: string,
): Promise<CursoQualificacao | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE qualificacoes_cursos
    SET status = 'APROVADO', aprovado_por = ${aprovadorId}, decidido_em = NOW(),
        motivo_recusa = NULL
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<CursoQualificacao[]>`
    ${SELECT_CURSO(sql)} WHERE id = ${id}
  `;
  return linha;
}

export async function recusarCurso(
  id: string,
  aprovadorId: string,
  motivo: string,
): Promise<CursoQualificacao | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE qualificacoes_cursos
    SET status = 'RECUSADO', aprovado_por = ${aprovadorId}, decidido_em = NOW(),
        motivo_recusa = ${motivo}
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<CursoQualificacao[]>`
    ${SELECT_CURSO(sql)} WHERE id = ${id}
  `;
  return linha;
}

/* ────────────────────────────────────────────────────────────────────────
 * Idiomas
 * ──────────────────────────────────────────────────────────────────────── */

export type NivelCEFR = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type OrigemAvaliacaoIdioma = "AUTODECLARADO" | "TESTE_INTERNO";

export interface Idioma {
  id: string;
  userId: string;
  idioma: string;
  nivelCefr: NivelCEFR;
  origemAvaliacao: OrigemAvaliacaoIdioma;
  avaliadoEm: string | null;
  status: StatusQualificacao;
  motivoRecusa: string | null;
}

export type IdiomaPublico = Omit<Idioma, "status" | "motivoRecusa">;

export interface IdiomaInput {
  idioma: string;
  nivelCefr: NivelCEFR;
  origemAvaliacao: OrigemAvaliacaoIdioma;
  avaliadoEm: string | null;
}

const SELECT_IDIOMA = (sql: ReturnType<typeof postgres>) => sql`
  SELECT id, user_id AS "userId", idioma, nivel_cefr AS "nivelCefr",
         origem_avaliacao AS "origemAvaliacao",
         to_char(avaliado_em, 'YYYY-MM-DD') AS "avaliadoEm",
         status, motivo_recusa AS "motivoRecusa"
  FROM qualificacoes_idiomas
`;

export async function listMeusIdiomas(userId: string): Promise<Idioma[]> {
  const sql = getDatabase();
  return sql<Idioma[]>`
    ${SELECT_IDIOMA(sql)} WHERE user_id = ${userId} ORDER BY idioma
  `;
}

export async function listIdiomasAprovados(userId: string): Promise<IdiomaPublico[]> {
  const sql = getDatabase();
  const linhas = await sql<Idioma[]>`
    ${SELECT_IDIOMA(sql)} WHERE user_id = ${userId} AND status = 'APROVADO' ORDER BY idioma
  `;
  return linhas.map((linha) => ({
    id: linha.id,
    userId: linha.userId,
    idioma: linha.idioma,
    nivelCefr: linha.nivelCefr,
    origemAvaliacao: linha.origemAvaliacao,
    avaliadoEm: linha.avaliadoEm,
  }));
}

export async function listIdiomasPendentes(): Promise<Idioma[]> {
  const sql = getDatabase();
  return sql<Idioma[]>`
    ${SELECT_IDIOMA(sql)} WHERE status = 'PENDENTE' ORDER BY id
  `;
}

/** Um idioma por id, qualquer status. `null` se não existir. */
export async function getIdiomaPorId(id: string): Promise<Idioma | null> {
  const sql = getDatabase();
  const linhas = await sql<Idioma[]>`
    ${SELECT_IDIOMA(sql)} WHERE id = ${id}
  `;
  return linhas[0] ?? null;
}

/**
 * Cria ou atualiza (upsert) o idioma do colaborador — só um registro por
 * idioma por pessoa (índice único). Editar volta o status pra PENDENTE
 * (precisa de nova aprovação do RH).
 */
export async function criarOuAtualizarIdioma(
  userId: string,
  input: IdiomaInput,
): Promise<Idioma> {
  const sql = getDatabase();
  const [salvo] = await sql<{ id: string }[]>`
    INSERT INTO qualificacoes_idiomas (
      user_id, idioma, nivel_cefr, origem_avaliacao, avaliado_em
    )
    VALUES (${userId}, ${input.idioma}, ${input.nivelCefr}, ${input.origemAvaliacao}, ${input.avaliadoEm})
    ON CONFLICT (user_id, idioma) DO UPDATE SET
      nivel_cefr = EXCLUDED.nivel_cefr,
      origem_avaliacao = EXCLUDED.origem_avaliacao,
      avaliado_em = EXCLUDED.avaliado_em,
      status = 'PENDENTE',
      aprovado_por = NULL,
      decidido_em = NULL,
      motivo_recusa = NULL
    RETURNING id
  `;
  const [linha] = await sql<Idioma[]>`
    ${SELECT_IDIOMA(sql)} WHERE id = ${salvo.id}
  `;
  return linha;
}

export async function excluirIdioma(
  id: string,
  userId: string,
  podeExcluirQualquer: boolean,
): Promise<boolean> {
  const sql = getDatabase();
  const deletado = podeExcluirQualquer
    ? await sql`DELETE FROM qualificacoes_idiomas WHERE id = ${id}`
    : await sql`DELETE FROM qualificacoes_idiomas WHERE id = ${id} AND user_id = ${userId}`;
  return deletado.count > 0;
}

export async function aprovarIdioma(
  id: string,
  aprovadorId: string,
): Promise<Idioma | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE qualificacoes_idiomas
    SET status = 'APROVADO', aprovado_por = ${aprovadorId}, decidido_em = NOW(),
        motivo_recusa = NULL
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<Idioma[]>`
    ${SELECT_IDIOMA(sql)} WHERE id = ${id}
  `;
  return linha;
}

export async function recusarIdioma(
  id: string,
  aprovadorId: string,
  motivo: string,
): Promise<Idioma | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE qualificacoes_idiomas
    SET status = 'RECUSADO', aprovado_por = ${aprovadorId}, decidido_em = NOW(),
        motivo_recusa = ${motivo}
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<Idioma[]>`
    ${SELECT_IDIOMA(sql)} WHERE id = ${id}
  `;
  return linha;
}

/* ────────────────────────────────────────────────────────────────────────
 * Visão geral (dashboard da tela de Cursos e Qualificações)
 * ──────────────────────────────────────────────────────────────────────── */

export interface QualificacoesResumoDTO {
  formados: { count: number; total: number };
  emFormacao: { count: number; total: number };
  cursosRapidos: { count: number; total: number };
}

/**
 * Estatísticas agregadas (cards do topo). "Formados"/"em formação" olham
 * qualificacoes_academicas (situação concluído/em andamento); "cursos
 * rápidos" olha qualificacoes_cursos (certificações + cursos + workshops).
 * Só conta o que já está APROVADO — nunca pendente/recusado.
 */
export async function getQualificacoesResumo(): Promise<QualificacoesResumoDTO> {
  const sql = getDatabase();

  const [{ total }] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM users WHERE is_active = TRUE
  `;
  const [{ formados }] = await sql<{ formados: number }[]>`
    SELECT COUNT(DISTINCT user_id)::int AS formados
    FROM qualificacoes_academicas
    WHERE status = 'APROVADO' AND situacao = 'CONCLUIDO'
  `;
  const [{ emFormacao }] = await sql<{ emFormacao: number }[]>`
    SELECT COUNT(DISTINCT user_id)::int AS "emFormacao"
    FROM qualificacoes_academicas
    WHERE status = 'APROVADO' AND situacao = 'EM_ANDAMENTO'
  `;
  const [{ cursosRapidos }] = await sql<{ cursosRapidos: number }[]>`
    SELECT COUNT(DISTINCT user_id)::int AS "cursosRapidos"
    FROM qualificacoes_cursos
    WHERE status = 'APROVADO'
  `;

  return {
    formados: { count: formados, total },
    emFormacao: { count: emFormacao, total },
    cursosRapidos: { count: cursosRapidos, total },
  };
}

export interface FuncionarioQualificacoesDTO {
  id: string;
  nome: string;
  cargo: string;
  departamento: string;
  fotoUrl: string;
  iniciais: string;
  qtdFormacoes: number;
  qtdCursosWorkshops: number;
  qtdCertificacoes: number;
  total: number;
}

/**
 * Lista de colaboradores com a contagem de qualificações APROVADAS por tipo
 * (pro front desenhar os ícones + total da tabela "Funcionários").
 */
export async function listFuncionariosComQualificacoes(): Promise<
  FuncionarioQualificacoesDTO[]
> {
  const sql = getDatabase();

  const linhas = await sql<{
    id: string;
    nome: string;
    cargo: string;
    departamento: string;
    avatarUrl: string | null;
    qtdFormacoes: number;
    qtdCursosWorkshops: number;
    qtdCertificacoes: number;
  }[]>`
    SELECT
      u.id, u.nome,
      COALESCE(f.nome, '') AS cargo,
      COALESCE(d.nome, '') AS departamento,
      u.avatar_url AS "avatarUrl",
      COALESCE(qa.qtd, 0)::int AS "qtdFormacoes",
      COALESCE(qcw.qtd, 0)::int AS "qtdCursosWorkshops",
      COALESCE(qc.qtd, 0)::int AS "qtdCertificacoes"
    FROM users u
    LEFT JOIN functions f ON f.id = u.function_id
    LEFT JOIN setor d ON d.id = u.setor_id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS qtd FROM qualificacoes_academicas
      WHERE status = 'APROVADO' GROUP BY user_id
    ) qa ON qa.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS qtd FROM qualificacoes_cursos
      WHERE status = 'APROVADO' AND tipo IN ('CURSO', 'WORKSHOP') GROUP BY user_id
    ) qcw ON qcw.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS qtd FROM qualificacoes_cursos
      WHERE status = 'APROVADO' AND tipo = 'CERTIFICACAO' GROUP BY user_id
    ) qc ON qc.user_id = u.id
    WHERE u.is_active = TRUE
    ORDER BY u.nome
  `;

  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    cargo: linha.cargo,
    departamento: linha.departamento,
    fotoUrl: montarAvatarUrl(linha.id, linha.avatarUrl),
    iniciais: gerarIniciais(linha.nome),
    qtdFormacoes: linha.qtdFormacoes,
    qtdCursosWorkshops: linha.qtdCursosWorkshops,
    qtdCertificacoes: linha.qtdCertificacoes,
    total: linha.qtdFormacoes + linha.qtdCursosWorkshops + linha.qtdCertificacoes,
  }));
}
