import postgres from "postgres";

import { getDatabase } from "./database.js";

/**
 * Módulo de Férias/Folga — leitura e escrita das solicitações (tabela
 * ferias_solicitacoes), com os dados do colaborador resolvidos via JOIN em
 * users. As strings de exibição (período, ciclo, datas) são formatadas aqui
 * em pt-BR, sem depender de locale do banco.
 */

/* ── Formatação (pt-BR, sem dependências) ──────────────────────────────── */

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MESES_EXTENSO = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Converte um valor de data (Date | "YYYY-MM-DD") em Date, ou null. */
function paraData(valor: unknown): Date | null {
  if (!valor) return null;
  const d = valor instanceof Date ? valor : new Date(String(valor));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Período legível: "21 – 28 de nov, 2026" (mesmo mês) ou
 * "28 nov – 03 dez, 2026" (meses diferentes).
 */
function formatarPeriodo(inicio: Date, fim: Date): string {
  const dI = String(inicio.getDate()).padStart(2, "0");
  const dF = String(fim.getDate()).padStart(2, "0");
  const mI = MESES_ABREV[inicio.getMonth()];
  const mF = MESES_ABREV[fim.getMonth()];
  const ano = fim.getFullYear();
  if (inicio.getMonth() === fim.getMonth() && inicio.getFullYear() === fim.getFullYear()) {
    return `${dI} – ${dF} de ${mI}, ${ano}`;
  }
  return `${dI} ${mI} – ${dF} ${mF}, ${ano}`;
}

/** Ciclo de férias (aniversário de admissão): "7 de julho". */
function formatarCiclo(admissao: Date | null): string {
  if (!admissao) return "—";
  return `${admissao.getDate()} de ${MESES_EXTENSO[admissao.getMonth()]}`;
}

/** Iniciais (primeiro + último nome) para o fallback do avatar. */
function gerarIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Resolve o avatar para uma URL exibível (mesma regra de users). */
function montarAvatarUrl(userId: string, valor: string | null): string {
  if (!valor) return "";
  if (valor.startsWith("http") || valor.startsWith("data:")) return valor;
  return `/usuarios/${userId}/avatar`;
}

/**
 * Calcula o período aquisitivo VIGENTE (ciclo de 12 meses a partir do
 * aniversário de admissão que contém "hoje"). Retorna as datas ISO ou null.
 */
function cicloAquisitivoVigente(
  admissao: Date | null,
): { inicio: string; fim: string; inicioLegivel: string } | null {
  if (!admissao) return null;
  const hoje = new Date();
  const aniversarioEsteAno = new Date(
    hoje.getFullYear(),
    admissao.getMonth(),
    admissao.getDate(),
  );
  const inicio =
    aniversarioEsteAno > hoje
      ? new Date(hoje.getFullYear() - 1, admissao.getMonth(), admissao.getDate())
      : aniversarioEsteAno;
  const fim = new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate() - 1);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    inicio: iso(inicio),
    fim: iso(fim),
    inicioLegivel: `${MESES_ABREV[inicio.getMonth()]} ${inicio.getFullYear()}`,
  };
}

/* ── Tipos expostos ────────────────────────────────────────────────────── */

/** Status no contrato do front da "Visão geral". */
export type StatusFeriasFront = "PENDENTE" | "APROVADA" | "REJEITADA";

/** Solicitação com os dados do colaborador (para a Visão geral). */
export interface SolicitacaoFeriasDTO {
  id: string;
  funcionarioNome: string;
  matricula: string;
  cicloFerias: string;
  avatarUrl: string;
  iniciais: string;
  dias: number;
  inicio: string;
  periodo: string;
  dataSolicitacao: string;
  diasRestantes: number;
  diasTotais: number;
  status: StatusFeriasFront;
  motivoRejeicao?: string;
}

/** Item do histórico do próprio colaborador (aba Pessoal). */
export interface MinhaSolicitacaoDTO {
  id: string;
  periodo: string;
  detalhe: string;
  tipo: string;
  status: "APROVADO" | "PENDENTE" | "RECUSADO";
}

/** Resumo do saldo do colaborador (cards do topo). */
export interface FeriasResumoDTO {
  diasDisponiveis: number;
  diasAgendados: number;
  periodoAquisitivo: string;
}

/** Entrada para criar uma solicitação. */
export interface CriarSolicitacaoInput {
  tipo: "FERIAS" | "FOLGA";
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  abono: boolean;
  observacoes: string | null;
}

/** Dias de férias por período aquisitivo (regra CLT padrão). */
const DIAS_FERIAS_CICLO = 30;

/** Linha crua do JOIN solicitação + colaborador. */
interface LinhaSolicitacao {
  id: string;
  tipo: "FERIAS" | "FOLGA";
  status: "PENDENTE" | "APROVADO" | "RECUSADO";
  dias: number;
  abono: boolean;
  observacoes: string | null;
  data_inicio: unknown;
  data_fim: unknown;
  dataSolicitacao: string;
  motivo_recusa: string | null;
  userId: string;
  funcionarioNome: string;
  avatarUrl: string | null;
  data_admissao: unknown;
}

const SELECT_SOLICITACAO = (sql: ReturnType<typeof postgres>) => sql`
  SELECT f.id, f.tipo, f.status, f.dias, f.abono, f.observacoes,
         f.data_inicio, f.data_fim,
         to_char(f.created_at, 'DD/MM/YYYY') AS "dataSolicitacao",
         f.motivo_recusa,
         u.id            AS "userId",
         u.nome          AS "funcionarioNome",
         u.avatar_url    AS "avatarUrl",
         u.data_admissao AS data_admissao
  FROM ferias_solicitacoes f
  JOIN users u ON u.id = f.user_id
`;

/** DB status → status do contrato do front (Visão geral). */
function statusParaFront(status: LinhaSolicitacao["status"]): StatusFeriasFront {
  if (status === "APROVADO") return "APROVADA";
  if (status === "RECUSADO") return "REJEITADA";
  return "PENDENTE";
}

/** Converte a linha do banco no DTO da Visão geral. */
function paraDTO(linha: LinhaSolicitacao): SolicitacaoFeriasDTO {
  const inicio = paraData(linha.data_inicio) ?? new Date();
  const fim = paraData(linha.data_fim) ?? inicio;
  return {
    id: linha.id,
    funcionarioNome: linha.funcionarioNome,
    matricula: "",
    cicloFerias: formatarCiclo(paraData(linha.data_admissao)),
    avatarUrl: montarAvatarUrl(linha.userId, linha.avatarUrl),
    iniciais: gerarIniciais(linha.funcionarioNome),
    dias: linha.dias,
    inicio: inicio.toISOString().slice(0, 10),
    periodo: formatarPeriodo(inicio, fim),
    dataSolicitacao: linha.dataSolicitacao,
    // Saldo aproximado (refinar depois): total 30, resta 30 - dias do pedido.
    diasRestantes: Math.max(0, DIAS_FERIAS_CICLO - linha.dias),
    diasTotais: DIAS_FERIAS_CICLO,
    status: statusParaFront(linha.status),
    motivoRejeicao: linha.motivo_recusa ?? undefined,
  };
}

/* ── Consultas ─────────────────────────────────────────────────────────── */

/** Lista TODAS as solicitações (Visão geral do gestor/RH). */
export async function listSolicitacoes(): Promise<SolicitacaoFeriasDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)}
    ORDER BY f.created_at DESC
  `;
  return linhas.map(paraDTO);
}

/** Histórico do próprio colaborador (aba Pessoal). */
export async function listMinhasSolicitacoes(
  userId: string,
): Promise<MinhaSolicitacaoDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)}
    WHERE f.user_id = ${userId}
    ORDER BY f.created_at DESC
  `;
  return linhas.map((linha) => {
    const inicio = paraData(linha.data_inicio) ?? new Date();
    const fim = paraData(linha.data_fim) ?? inicio;
    const tipoLabel =
      linha.tipo === "FOLGA"
        ? "Folga"
        : linha.abono
          ? "Férias + Abono"
          : "Férias Regulares";
    const detalhe = `${linha.dias} dias${linha.abono ? " (Abono incluso)" : " corridos"}`;
    return {
      id: linha.id,
      periodo: formatarPeriodo(inicio, fim),
      detalhe,
      tipo: tipoLabel,
      status: linha.status, // APROVADO | PENDENTE | RECUSADO (mesmo do front)
    };
  });
}

/** Resumo do saldo do colaborador (cards do topo da aba Pessoal). */
export async function getResumoFerias(userId: string): Promise<FeriasResumoDTO> {
  const sql = getDatabase();

  const [u] = await sql<{ data_admissao: unknown }[]>`
    SELECT data_admissao FROM users WHERE id = ${userId} LIMIT 1
  `;
  const ciclo = cicloAquisitivoVigente(paraData(u?.data_admissao));

  // Dias de férias APROVADAS já agendados (futuros) neste ciclo.
  const [agendados] = await sql<{ total: number | null }[]>`
    SELECT COALESCE(SUM(dias), 0)::int AS total
    FROM ferias_solicitacoes
    WHERE user_id = ${userId}
      AND tipo = 'FERIAS'
      AND status = 'APROVADO'
      AND data_inicio >= CURRENT_DATE
  `;
  const diasAgendados = agendados?.total ?? 0;

  return {
    diasDisponiveis: Math.max(0, DIAS_FERIAS_CICLO - diasAgendados),
    diasAgendados,
    periodoAquisitivo: ciclo
      ? `${formatarPeriodoResumo(ciclo.inicio)} - ${formatarPeriodoResumo(ciclo.fim)}`
      : "—",
  };
}

/** "07 Jul 2026" a partir de "YYYY-MM-DD". */
function formatarPeriodoResumo(iso: string): string {
  const d = new Date(iso);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = MESES_ABREV[d.getMonth()];
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${dia} ${mesCap} ${d.getFullYear()}`;
}

/* ── Escrita ───────────────────────────────────────────────────────────── */

/** Cria uma solicitação (status PENDENTE) e devolve o DTO da Visão geral. */
export async function criarSolicitacao(
  userId: string,
  input: CriarSolicitacaoInput,
): Promise<SolicitacaoFeriasDTO> {
  const sql = getDatabase();

  const inicio = new Date(input.dataInicio);
  const fim = new Date(input.dataFim);
  // Dias corridos, inclusive (início e fim contam).
  const dias =
    Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;

  // Congela o ciclo aquisitivo vigente do colaborador (histórico).
  const [u] = await sql<{ data_admissao: unknown }[]>`
    SELECT data_admissao FROM users WHERE id = ${userId} LIMIT 1
  `;
  const ciclo = cicloAquisitivoVigente(paraData(u?.data_admissao));

  const [criada] = await sql<{ id: string }[]>`
    INSERT INTO ferias_solicitacoes (
      user_id, tipo, data_inicio, data_fim, dias, abono, observacoes,
      periodo_aquisitivo_inicio, periodo_aquisitivo_fim, status
    )
    VALUES (
      ${userId}, ${input.tipo}, ${input.dataInicio}, ${input.dataFim}, ${dias},
      ${input.abono}, ${input.observacoes},
      ${ciclo?.inicio ?? null}, ${ciclo?.fim ?? null}, 'PENDENTE'
    )
    RETURNING id
  `;

  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${criada.id}
  `;
  return paraDTO(linha);
}

/** Aprova uma solicitação. Retorna o DTO atualizado ou null se não existir. */
export async function aprovarSolicitacao(
  id: string,
  aprovadorId: string,
): Promise<SolicitacaoFeriasDTO | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE ferias_solicitacoes
    SET status = 'APROVADO', aprovado_por = ${aprovadorId},
        decidido_em = NOW(), confirmado = TRUE, motivo_recusa = NULL
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${id}
  `;
  return linha ? paraDTO(linha) : null;
}

/** Recusa uma solicitação com justificativa. Retorna o DTO ou null. */
export async function recusarSolicitacao(
  id: string,
  aprovadorId: string,
  motivo: string,
): Promise<SolicitacaoFeriasDTO | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE ferias_solicitacoes
    SET status = 'RECUSADO', aprovado_por = ${aprovadorId},
        decidido_em = NOW(), motivo_recusa = ${motivo}
    WHERE id = ${id} AND status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${id}
  `;
  return linha ? paraDTO(linha) : null;
}

/** Dados de uma solicitação para emitir notificações (dono + resumo). */
export async function getSolicitacaoParaNotificar(id: string): Promise<{
  userId: string;
  funcionarioNome: string;
  periodo: string;
  dias: number;
} | null> {
  const sql = getDatabase();
  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${id}
  `;
  if (!linha) return null;
  const inicio = paraData(linha.data_inicio) ?? new Date();
  const fim = paraData(linha.data_fim) ?? inicio;
  return {
    userId: linha.userId,
    funcionarioNome: linha.funcionarioNome,
    periodo: formatarPeriodo(inicio, fim),
    dias: linha.dias,
  };
}
