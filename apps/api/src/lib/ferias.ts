import postgres from "postgres";

import { responsavelPrimeiraEtapaSql, statusAposChefiaSql } from "./feriasFluxo.js";
import { getDatabase } from "./database.js";
import { buscarUltimaFeriasEsocial } from "./mssql.js";

/**
 * Módulo de Férias/Folga — leitura e escrita das solicitações (tabela
 * ferias_solicitacoes), com os dados do colaborador resolvidos via JOIN em
 * users. As strings de exibição (período, ciclo, datas) são formatadas aqui
 * em pt-BR, sem depender de locale do banco.
 */

/**
 * Lançada quando o colaborador já tem uma solicitação de FÉRIAS pendente e
 * tenta pedir férias de novo — só pode ter uma pendente por vez (folga não
 * entra nessa regra). A rota converte isso num 409.
 */
export class SolicitacaoFeriasPendenteError extends Error {
  constructor(
    message = "Você já tem uma solicitação de férias pendente. Aguarde a decisão do RH antes de pedir de novo.",
  ) {
    super(message);
    this.name = "SolicitacaoFeriasPendenteError";
  }
}

/**
 * Lançada quando o colaborador tenta pedir FÉRIAS de novo, mas já tem uma
 * solicitação APROVADA (confirmada pelo Tesoureiro Assistente, ou lançada manualmente pelo RH)
 * com início dentro do MESMO período aquisitivo vigente (ciclo de 12 meses a
 * partir do aniversário de admissão) — o ciclo já foi usado. A rota converte
 * isso num 409, igual ao "já tem pendente".
 */
export class SolicitacaoFeriasJaAprovadaError extends Error {
  constructor(
    message = "Você já tem férias aprovadas para este período aquisitivo. Aguarde o próximo ciclo para solicitar novamente.",
  ) {
    super(message);
    this.name = "SolicitacaoFeriasJaAprovadaError";
  }
}

/**
 * Lançada quando um pedido de FÉRIAS quebra uma regra de negócio (antecedência
 * mínima ou dia de início inválido). A rota converte isso num 400. Espelha as
 * validações do front (NovaSolicitacaoForm) para que a regra valha mesmo que
 * alguém chame a API direto, sem passar pela tela.
 */
export class SolicitacaoFeriasInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SolicitacaoFeriasInvalidaError";
  }
}

/**
 * Antecedência mínima (em dias) para solicitar FÉRIAS — política da empresa
 * (a CLT art. 145 exige 30). Mantido em sincronia com o mesmo valor no front
 * (NovaSolicitacaoForm). Não se aplica à FOLGA.
 */
const ANTECEDENCIA_MINIMA_FERIAS_DIAS = 40;

/** Converte "YYYY-MM-DD" numa Date local à meia-noite (sem susto de fuso). */
function dataLocalDeISO(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * Valida as regras de FÉRIAS (não se aplica à FOLGA): início com pelo menos
 * ANTECEDENCIA_MINIMA_FERIAS_DIAS de antecedência e fora de sexta/sábado/
 * domingo. Lança SolicitacaoFeriasInvalidaError na primeira violação.
 */
function validarRegrasFerias(dataInicioISO: string): void {
  const inicio = dataLocalDeISO(dataInicioISO);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const diasDeAntecedencia = Math.round(
    (inicio.getTime() - hoje.getTime()) / 86_400_000,
  );
  if (diasDeAntecedencia < ANTECEDENCIA_MINIMA_FERIAS_DIAS) {
    throw new SolicitacaoFeriasInvalidaError(
      `As férias devem ser solicitadas com no mínimo ${ANTECEDENCIA_MINIMA_FERIAS_DIAS} dias de antecedência.`,
    );
  }

  // 0 = domingo, 5 = sexta, 6 = sábado.
  const diaSemana = inicio.getDay();
  if (diaSemana === 0 || diaSemana === 5 || diaSemana === 6) {
    throw new SolicitacaoFeriasInvalidaError(
      "O início das férias não pode ser sexta, sábado ou domingo.",
    );
  }
}

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
 * Calcula o ciclo aquisitivo (12 meses a partir do aniversário de admissão)
 * que contém `referencia` (default: hoje). Passar a data de início de um
 * pedido de férias dá o ciclo AO QUAL aquele pedido pertence (pode ser um
 * ciclo futuro, se o pedido for antecipado) — não necessariamente o ciclo
 * vigente "agora". Retorna as datas ISO ou null.
 */
function cicloAquisitivoVigente(
  admissao: Date | null,
  referencia: Date = new Date(),
): { inicio: string; fim: string; inicioLegivel: string } | null {
  if (!admissao) return null;
  const aniversarioEsteAno = new Date(
    referencia.getFullYear(),
    admissao.getMonth(),
    admissao.getDate(),
  );
  const inicio =
    aniversarioEsteAno > referencia
      ? new Date(referencia.getFullYear() - 1, admissao.getMonth(), admissao.getDate())
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

/**
 * Status no contrato do front da "Visão geral":
 *   PENDENTE          → aguardando o gestor do setor (1ª etapa).
 *   AGUARDANDO_RH     → aguarda análise do RH (exceto quando o solicitante é RH).
 *   AGUARDANDO_ASSISTENTE → aguarda confirmação final (3ª etapa).
 *   AJUSTE_SUGERIDO   → RH devolveu ao colaborador uma sugestão de nova data
 *                       (em vez de aprovar); aguardando o colaborador aceitar.
 *   APROVADA          → Tesoureiro Assistente confirmou (final).
 *   REJEITADA         → recusada pelo gestor, RH ou Tesoureiro Assistente.
 *   CANCELADA         → cancelada (colaborador antes de confirmar, ou RH/Assistente depois).
 */
export type StatusFeriasFront =
  | "PENDENTE"
  | "AGUARDANDO_RH"
  | "AGUARDANDO_ASSISTENTE"
  | "AJUSTE_SUGERIDO"
  | "APROVADA"
  | "REJEITADA"
  | "CANCELADA";

/** Origem da solicitação: pedido normal do colaborador ou lançamento manual do RH. */
export type OrigemFerias = "SOLICITACAO" | "REGISTRO_MANUAL";

/** Solicitação com os dados do colaborador (para a Visão geral). */
export interface SolicitacaoFeriasDTO {
  id: string;
  /** FERIAS ou FOLGA — a Visão geral mistura os dois tipos na mesma lista. */
  tipo: "FERIAS" | "FOLGA";
  /** ID do colaborador solicitante (para o front saber se é do próprio usuário). */
  userId: string;
  /** Papel do solicitante (RH solicitante dispensa sua etapa de revisão). */
  solicitantePapel?: string;
  /** Responsável efetivo da 1ª etapa, calculado a partir da chefia vigente. */
  responsavelPrimeiraEtapaId?: string;
  /** Solicitante RH segue direto ao Assistente, sem registrar aprovação fictícia. */
  etapaRhDispensada: boolean;
  funcionarioNome: string;
  matricula: string;
  cicloFerias: string;
  avatarUrl: string;
  iniciais: string;
  dias: number;
  /** Dias vendidos (abono) nesse pedido, 0-10 — ver DIAS_VENDA_MAXIMO. */
  diasVendidos: number;
  inicio: string;
  periodo: string;
  dataSolicitacao: string;
  diasRestantes: number;
  diasTotais: number;
  status: StatusFeriasFront;
  motivoRejeicao?: string;
  /** SOLICITACAO (pedido normal) ou REGISTRO_MANUAL (lançado pelo RH/Admin). */
  origem: OrigemFerias;
  /** Progresso da aprovação — quem aprovou/confirmou/cancelou e quando. */
  aprovadoGestorNome?: string;
  aprovadoGestorEm?: string;
  aprovadoRhNome?: string;
  aprovadoRhEm?: string;
  /** Nome de quem decidiu ao final (campo legado do contrato). */
  aprovadoDpNome?: string;
  decididoEm?: string;
  canceladoNome?: string;
  canceladoEm?: string;
  motivoCancelamento?: string;
  /** Ajuste sugerido pelo RH (status AJUSTE_SUGERIDO) — período proposto + motivo. */
  periodoSugerido?: string;
  ajusteSugeridoPorNome?: string;
  ajusteSugeridoEm?: string;
  motivoAjuste?: string;
}

/** Item do histórico do próprio colaborador (aba Pessoal). */
export interface MinhaSolicitacaoDTO {
  id: string;
  periodo: string;
  detalhe: string;
  /** Rótulo de exibição (ex.: "Férias Regulares", "Folga"). */
  tipo: string;
  /** Tipo "cru" (FERIAS/FOLGA), pra checagens do front sem parsear `tipo`. */
  tipoBase: "FERIAS" | "FOLGA";
  /** Dias vendidos (abono) nesse pedido, 0-10 — ver DIAS_VENDA_MAXIMO. */
  diasVendidos: number;
  status: "PENDENTE" | "APROVADO_GESTOR" | "APROVADO_RH" | "AJUSTE_SUGERIDO" | "APROVADO" | "RECUSADO" | "CANCELADO";
  /** SOLICITACAO (pedido normal) ou REGISTRO_MANUAL (lançado pelo RH/Admin). */
  origem: OrigemFerias;
  /** Motivo, quando RECUSADO. */
  motivoRejeicao?: string;
  /** Ajuste sugerido pelo RH (status AJUSTE_SUGERIDO) — período proposto + motivo. */
  periodoSugerido?: string;
  motivoAjuste?: string;
}

/** Resumo do saldo do colaborador (cards do topo). */
export interface FeriasResumoDTO {
  diasDisponiveis: number;
  diasAgendados: number;
  periodoAquisitivo: string;
  /** Exceções liberadas pelo RH pra esse colaborador — ver 024_ferias_excecoes.sql. */
  podeFracionarFerias: boolean;
  podeVenderFerias: boolean;
  /**
   * A entidade do colaborador pertence a um grupo que exige o período
   * completo de 30 dias corridos (sem selecionar um período mais curto no
   * calendário) — ver GRUPOS_EXIGEM_TRINTA_DIAS. `podeFracionarFerias`
   * continua sendo uma exceção por cima disso: quem tem as duas, ainda
   * pode escolher 10/15 dias pela aba "Fracionar em".
   */
  exigeTrintaDias: boolean;
  /**
   * Próxima (ou em andamento) férias já APROVADA do colaborador, pro card do
   * dashboard (/home) — null quando não há nenhuma aprovada com fim ainda não
   * passado (mesmo que exista uma solicitação pendente, ainda não decidida).
   */
  proximaAprovada: {
    diasParaInicio: number;
    periodo: string;
  } | null;
}

/** Entrada para criar uma solicitação. */
export interface CriarSolicitacaoInput {
  tipo: "FERIAS" | "FOLGA";
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  observacoes: string | null;
  /** Dias vendidos (abono), 0-10. Só aceito se o colaborador tiver pode_vender_ferias. */
  diasVendidos?: number;
}

/** Dias de férias por período aquisitivo (regra CLT padrão). */
const DIAS_FERIAS_CICLO = 30;

/**
 * Grupos de entidade (`entities.grupo`, ver 001_entities.sql) cujos
 * colaboradores só podem pedir o período completo de 30 dias corridos — o
 * calendário do front trava a duração (ver exigeTrintaDias em
 * getResumoFerias). Por enquanto só ACeAm; adicione outros grupos aqui
 * conforme for pedido.
 */
const GRUPOS_EXIGEM_TRINTA_DIAS = new Set(["ACeAm"]);

/**
 * Regras das exceções de fracionamento/venda (ver 024_ferias_excecoes.sql e
 * a tela "Exceções" do DP). Fracionar é OPCIONAL: quem tem a exceção também
 * pode continuar pedindo um período único de até 30 dias, como quem não tem.
 */
const DIAS_FRACIONAMENTO_MIN = 10;
const DIAS_FRACIONAMENTO_MAX = 15;
const DIAS_VENDA_MAXIMO = 10;

/** Status "cru" do banco (6 valores do CHECK). */
type StatusDB =
  | "PENDENTE"
  | "APROVADO_GESTOR"
  | "APROVADO_RH"
  | "AJUSTE_SUGERIDO"
  | "APROVADO"
  | "RECUSADO"
  | "CANCELADO";

/** Linha crua do JOIN solicitação + colaborador. */
interface LinhaSolicitacao {
  id: string;
  tipo: "FERIAS" | "FOLGA";
  status: StatusDB;
  dias: number;
  dias_vendidos: number;
  observacoes: string | null;
  data_inicio: unknown;
  data_fim: unknown;
  dataSolicitacao: string;
  motivo_recusa: string | null;
  origem: OrigemFerias;
  userId: string;
  setorId: string | null;
  solicitantePapel: string | null;
  responsavelPrimeiraEtapaId: string | null;
  funcionarioNome: string;
  funcionarioEmail: string;
  avatarUrl: string | null;
  data_admissao: unknown;
  aprovadoGestorNome: string | null;
  aprovadoGestorEm: string | null;
  aprovadoRhNome: string | null;
  aprovadoRhEm: string | null;
  aprovadoDpNome: string | null;
  decididoEm: string | null;
  canceladoNome: string | null;
  canceladoEm: string | null;
  motivo_cancelamento: string | null;
  data_inicio_sugerida: unknown;
  data_fim_sugerida: unknown;
  ajusteSugeridoPorNome: string | null;
  ajusteSugeridoEm: string | null;
  motivo_ajuste: string | null;
}

const SELECT_SOLICITACAO = (sql: ReturnType<typeof postgres>) => sql`
  SELECT f.id, f.tipo, f.status, f.dias, f.dias_vendidos, f.observacoes,
         f.data_inicio, f.data_fim,
         to_char(f.created_at, 'DD/MM/YYYY') AS "dataSolicitacao",
         f.motivo_recusa,
         f.origem,
         to_char(f.aprovado_gestor_em, 'DD/MM/YYYY') AS "aprovadoGestorEm",
         to_char(f.aprovado_rh_em, 'DD/MM/YYYY') AS "aprovadoRhEm",
         to_char(f.decidido_em,        'DD/MM/YYYY') AS "decididoEm",
         to_char(f.cancelado_em,       'DD/MM/YYYY') AS "canceladoEm",
         f.motivo_cancelamento,
         f.data_inicio_sugerida, f.data_fim_sugerida,
         to_char(f.ajuste_sugerido_em, 'DD/MM/YYYY') AS "ajusteSugeridoEm",
         f.motivo_ajuste,
         ${responsavelPrimeiraEtapaSql(sql)} AS "responsavelPrimeiraEtapaId",
         u.id            AS "userId",
         u.setor_id      AS "setorId",
         ru.codigo       AS "solicitantePapel",
         u.nome          AS "funcionarioNome",
         u.email         AS "funcionarioEmail",
         u.avatar_url    AS "avatarUrl",
         u.data_admissao AS data_admissao,
         ag.nome         AS "aprovadoGestorNome",
         rh.nome         AS "aprovadoRhNome",
         ap.nome         AS "aprovadoDpNome",
         cx.nome         AS "canceladoNome",
         aj.nome         AS "ajusteSugeridoPorNome"
  FROM ferias_solicitacoes f
  JOIN users u ON u.id = f.user_id
  LEFT JOIN roles ru ON ru.id = u.role_id
  LEFT JOIN users ag ON ag.id = f.aprovado_gestor_por
  LEFT JOIN users rh ON rh.id = f.aprovado_rh_por
  LEFT JOIN users ap ON ap.id = f.aprovado_por
  LEFT JOIN users cx ON cx.id = f.cancelado_por
  LEFT JOIN users aj ON aj.id = f.ajuste_sugerido_por
`;

/** DB status → status do contrato do front (Visão geral). */
function statusParaFront(status: StatusDB): StatusFeriasFront {
  if (status === "APROVADO_GESTOR") return "AGUARDANDO_RH";
  if (status === "APROVADO_RH") return "AGUARDANDO_ASSISTENTE";
  if (status === "AJUSTE_SUGERIDO") return "AJUSTE_SUGERIDO";
  if (status === "APROVADO") return "APROVADA";
  if (status === "RECUSADO") return "REJEITADA";
  if (status === "CANCELADO") return "CANCELADA";
  return "PENDENTE";
}

/** Converte a linha do banco no DTO da Visão geral. */
function paraDTO(linha: LinhaSolicitacao): SolicitacaoFeriasDTO {
  const inicio = paraData(linha.data_inicio) ?? new Date();
  const fim = paraData(linha.data_fim) ?? inicio;
  return {
    id: linha.id,
    tipo: linha.tipo,
    userId: linha.userId,
    solicitantePapel: linha.solicitantePapel ?? undefined,
    responsavelPrimeiraEtapaId: linha.responsavelPrimeiraEtapaId ?? undefined,
    etapaRhDispensada: linha.origem === "SOLICITACAO" && linha.solicitantePapel === "RH" && !linha.aprovadoRhEm,
    funcionarioNome: linha.funcionarioNome,
    matricula: "",
    cicloFerias: formatarCiclo(paraData(linha.data_admissao)),
    avatarUrl: montarAvatarUrl(linha.userId, linha.avatarUrl),
    iniciais: gerarIniciais(linha.funcionarioNome),
    dias: linha.dias,
    diasVendidos: linha.dias_vendidos,
    inicio: inicio.toISOString().slice(0, 10),
    periodo: formatarPeriodo(inicio, fim),
    dataSolicitacao: linha.dataSolicitacao,
    // Saldo aproximado (refinar depois): total 30, resta 30 - dias do pedido.
    diasRestantes: Math.max(0, DIAS_FERIAS_CICLO - linha.dias),
    diasTotais: DIAS_FERIAS_CICLO,
    status: statusParaFront(linha.status),
    motivoRejeicao: linha.motivo_recusa ?? undefined,
    origem: linha.origem,
    aprovadoGestorNome: linha.aprovadoGestorNome ?? undefined,
    aprovadoGestorEm: linha.aprovadoGestorEm ?? undefined,
    aprovadoRhNome: linha.aprovadoRhNome ?? undefined,
    aprovadoRhEm: linha.aprovadoRhEm ?? undefined,
    aprovadoDpNome: linha.aprovadoDpNome ?? undefined,
    decididoEm: linha.decididoEm ?? undefined,
    canceladoNome: linha.canceladoNome ?? undefined,
    canceladoEm: linha.canceladoEm ?? undefined,
    motivoCancelamento: linha.motivo_cancelamento ?? undefined,
    periodoSugerido: periodoSugerido(linha),
    ajusteSugeridoPorNome: linha.ajusteSugeridoPorNome ?? undefined,
    ajusteSugeridoEm: linha.ajusteSugeridoEm ?? undefined,
    motivoAjuste: linha.motivo_ajuste ?? undefined,
  };
}

/** Período sugerido pelo RH formatado igual a `periodo` (ou undefined, se não houver). */
function periodoSugerido(linha: LinhaSolicitacao): string | undefined {
  const inicio = paraData(linha.data_inicio_sugerida);
  const fim = paraData(linha.data_fim_sugerida);
  return inicio && fim ? formatarPeriodo(inicio, fim) : undefined;
}

/* ── Consultas ─────────────────────────────────────────────────────────── */

/**
 * Lista solicitações para a Visão geral. Se `gestorId` for informado, restringe
 * às solicitações dos setores que esse gestor lidera (gestor só vê a própria
 * equipe); sem ele, lista todas (DP/RH/ADMIN).
 */
export async function listSolicitacoes(
  gestorId?: string,
  incluirHistoricoCompleto = false,
): Promise<SolicitacaoFeriasDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)}
    -- Mantém pedidos ativos/futuros e o último período passado aprovado
    -- de cada pessoa. O histórico pessoal continua completo.
    WHERE (${incluirHistoricoCompleto} OR f.data_fim >= CURRENT_DATE OR f.status NOT IN ('APROVADO', 'RECUSADO', 'CANCELADO')
      OR f.id = (
        SELECT ultima.id FROM ferias_solicitacoes ultima
        WHERE ultima.user_id = f.user_id AND ultima.tipo = 'FERIAS'
          AND ultima.status = 'APROVADO' AND ultima.data_fim < CURRENT_DATE
        ORDER BY ultima.data_fim DESC, ultima.data_inicio DESC, ultima.created_at DESC, ultima.id DESC
        LIMIT 1
      ))
    ${
      gestorId
        ? sql`AND u.setor_id IN (SELECT id FROM setor WHERE gestor_id = ${gestorId})`
        : sql``
    }
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
    const tipoLabel = linha.tipo === "FOLGA" ? "Folga" : "Férias Regulares";
    const detalhe =
      linha.dias_vendidos > 0
        ? `${linha.dias} dias corridos + ${linha.dias_vendidos} vendidos`
        : `${linha.dias} dias corridos`;
    return {
      id: linha.id,
      periodo: formatarPeriodo(inicio, fim),
      detalhe,
      tipo: tipoLabel,
      tipoBase: linha.tipo,
      diasVendidos: linha.dias_vendidos,
      status: linha.status,
      origem: linha.origem,
      motivoRejeicao: linha.motivo_recusa ?? undefined,
      periodoSugerido: periodoSugerido(linha),
      motivoAjuste: linha.motivo_ajuste ?? undefined,
    };
  });
}

/** Resumo do saldo do colaborador (cards do topo da aba Pessoal). */
export async function getResumoFerias(userId: string): Promise<FeriasResumoDTO> {
  const sql = getDatabase();

  const [u] = await sql<
    {
      data_admissao: unknown;
      pode_fracionar_ferias: boolean;
      pode_vender_ferias: boolean;
      entidade_grupo: string | null;
    }[]
  >`
    SELECT u.data_admissao, u.pode_fracionar_ferias, u.pode_vender_ferias,
           e.grupo AS entidade_grupo
    FROM users u
    LEFT JOIN entities e ON e.id = u.entity_id
    WHERE u.id = ${userId} LIMIT 1
  `;
  const ciclo = cicloAquisitivoVigente(paraData(u?.data_admissao));

  // Dias de férias APROVADAS "usados" no ciclo aquisitivo vigente — passados
  // OU futuros, contanto que o início caia dentro do ciclo. Importante:
  // filtrar por "dentro do ciclo" (não por "data_inicio >= hoje", como era
  // antes) é o que faz um REGISTRO_MANUAL retroativo (férias já tiradas fora
  // do sistema) reduzir corretamente o saldo — sem isso, o sistema achava
  // que o colaborador ainda tinha o ciclo inteiro disponível mesmo já tendo
  // tirado férias no passado, e deixava solicitar de novo indevidamente.
  // Sem data de admissão (ciclo null), cai de volta no comportamento antigo
  // (só futuro), já que não dá pra saber os limites do ciclo. `dias_vendidos`
  // entra na soma: vender também consome o período aquisitivo, igual a tirar.
  const [agendados] = await sql<{ total: number | null }[]>`
    SELECT COALESCE(SUM(dias + dias_vendidos), 0)::int AS total
    FROM ferias_solicitacoes
    WHERE user_id = ${userId}
      AND tipo = 'FERIAS'
      AND status = 'APROVADO'
      ${
        ciclo
          ? sql`AND data_inicio BETWEEN ${ciclo.inicio} AND ${ciclo.fim}`
          : sql`AND data_inicio >= CURRENT_DATE`
      }
  `;
  const diasAgendados = agendados?.total ?? 0;

  // Próxima férias aprovada (card do dashboard) — a mais próxima que ainda
  // não terminou, aprovada ou em andamento. Só FERIAS (o card fala "você sai
  // de férias", não cobre FOLGA avulsa).
  const [proxima] = await sql<{ inicio: string; fim: string }[]>`
    SELECT to_char(data_inicio, 'YYYY-MM-DD') AS inicio,
           to_char(data_fim, 'YYYY-MM-DD')    AS fim
    FROM ferias_solicitacoes
    WHERE user_id = ${userId} AND tipo = 'FERIAS' AND status = 'APROVADO'
      AND data_fim >= CURRENT_DATE
    ORDER BY data_inicio ASC
    LIMIT 1
  `;
  const proximaAprovada = proxima
    ? {
        diasParaInicio: Math.max(0, diasAte(proxima.inicio)),
        periodo: formatarPeriodo(dataLocalDeISO(proxima.inicio), dataLocalDeISO(proxima.fim)),
      }
    : null;

  return {
    diasDisponiveis: Math.max(0, DIAS_FERIAS_CICLO - diasAgendados),
    diasAgendados,
    exigeTrintaDias: Boolean(u?.entidade_grupo && GRUPOS_EXIGEM_TRINTA_DIAS.has(u.entidade_grupo)),
    podeFracionarFerias: u?.pode_fracionar_ferias ?? false,
    podeVenderFerias: u?.pode_vender_ferias ?? false,
    periodoAquisitivo: ciclo
      ? `${formatarPeriodoResumo(ciclo.inicio)} - ${formatarPeriodoResumo(ciclo.fim)}`
      : "—",
    proximaAprovada,
  };
}

/** "7 Jul 2026" a partir de "YYYY-MM-DD". */
function formatarPeriodoResumo(iso: string): string {
  const d = new Date(iso);
  const mes = MESES_ABREV[d.getMonth()];
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${d.getDate()} ${mesCap} ${d.getFullYear()}`;
}

/* ── Escrita ───────────────────────────────────────────────────────────── */

type StatusInicialSolicitacao = "PENDENTE" | "APROVADO_GESTOR" | "APROVADO_RH";

/** Roteamento compartilhado entre novo pedido e reinício após ajuste de datas. */
async function getRoteamentoInicialSolicitacao(
  sql: ReturnType<typeof postgres>,
  userId: string,
): Promise<{ gestorId: string | null; statusInicial: StatusInicialSolicitacao }> {
  const [row] = await sql<{
    responsavelId: string | null;
    statusSemChefia: "APROVADO_GESTOR" | "APROVADO_RH";
  }[]>`
    SELECT ${responsavelPrimeiraEtapaSql(sql)} AS "responsavelId",
           ${statusAposChefiaSql(sql)} AS "statusSemChefia"
    FROM users u WHERE u.id = ${userId}
  `;
  const gestorId = row?.responsavelId ?? null;
  return {
    gestorId,
    statusInicial: gestorId ? "PENDENTE" : row?.statusSemChefia ?? "APROVADO_GESTOR",
  };
}

/**
 * Bloqueia o início das férias que caia num feriado cadastrado, ou na
 * véspera de um (mesma regra aplicada no front — ver `feriadoOuVesperaDates`
 * em NovaSolicitacaoForm.tsx). Checa as duas datas (início e início + 1 dia)
 * numa só consulta.
 */
async function validarInicioNaoFeriado(
  sql: ReturnType<typeof postgres>,
  dataInicioISO: string,
): Promise<void> {
  const [feriado] = await sql<{ nome: string; vespera: boolean }[]>`
    SELECT nome, data <> ${dataInicioISO} AS vespera FROM feriados
    WHERE data = ${dataInicioISO} OR data = ${dataInicioISO}::date + 1
    ORDER BY data ASC
    LIMIT 1
  `;
  if (feriado) {
    throw new SolicitacaoFeriasInvalidaError(
      feriado.vespera
        ? `O início das férias não pode ser a véspera do feriado "${feriado.nome}".`
        : `O início das férias não pode cair no feriado "${feriado.nome}".`,
    );
  }
}

/** Resultado de criarSolicitacao — inclui o roteamento da 1ª notificação. */
export interface CriarSolicitacaoResultado {
  solicitacao: SolicitacaoFeriasDTO;
  /** Status inicial: chefia, RH ou Assistente (solicitante RH sem chefia). */
  statusInicial: StatusInicialSolicitacao;
  /** Gestor a notificar; null quando caiu no fallback (notificar RH ou Assistente). */
  gestorId: string | null;
}

/**
 * Cria uma solicitação e devolve o DTO + o roteamento da aprovação.
 *
 * Fluxo em 3 etapas (gestor → RH → Tesoureiro Assistente). Fallback: se o setor do solicitante
 * não tem gestor, ou o próprio solicitante É o gestor do setor, a 1ª etapa é
 * dispensada — segue ao RH (APROVADO_GESTOR), ou ao Assistente
 * (APROVADO_RH) quando o próprio solicitante é RH.
 */
export async function criarSolicitacao(
  userId: string,
  input: CriarSolicitacaoInput,
): Promise<CriarSolicitacaoResultado> {
  const sql = getDatabase();

  // Ciclo aquisitivo AO QUAL este pedido pertence — ancorado na data de
  // início solicitada (não em "hoje"), pra um pedido antecipado pro PRÓXIMO
  // ciclo não ser barrado por já ter férias aprovadas no ciclo atual. Usado
  // nas checagens de FÉRIAS abaixo (já aprovada no ciclo) e também é
  // congelado no registro (histórico).
  const [u] = await sql<
    { data_admissao: unknown; pode_fracionar_ferias: boolean; pode_vender_ferias: boolean }[]
  >`
    SELECT data_admissao, pode_fracionar_ferias, pode_vender_ferias
    FROM users WHERE id = ${userId} LIMIT 1
  `;
  const ciclo = cicloAquisitivoVigente(
    paraData(u?.data_admissao),
    dataLocalDeISO(input.dataInicio),
  );

  const inicio = new Date(input.dataInicio);
  const fim = new Date(input.dataFim);
  // Dias corridos, inclusive (início e fim contam).
  const dias =
    Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;
  const diasVendidos = input.diasVendidos ?? 0;

  if (input.tipo === "FERIAS") {
    // Venda (abono) exige a exceção liberada pelo DP — ver
    // 024_ferias_excecoes.sql e a tela "Exceções". O schema da rota já limita
    // 0-10; isto é o reforço de segurança (nunca confiar só no schema).
    if (diasVendidos > 0) {
      if (!u?.pode_vender_ferias) {
        throw new SolicitacaoFeriasInvalidaError(
          "Você não tem permissão para vender dias de férias.",
        );
      }
      if (diasVendidos > DIAS_VENDA_MAXIMO) {
        throw new SolicitacaoFeriasInvalidaError(
          `Só é possível vender até ${DIAS_VENDA_MAXIMO} dias de férias.`,
        );
      }
    }

    // Só pode ter UMA solicitação de FÉRIAS em andamento por vez (PENDENTE,
    // APROVADO_GESTOR, APROVADO_RH ou AJUSTE_SUGERIDO) — vale igual pra quem fraciona: a
    // 2ª leva só pode ser pedida depois que a 1ª foi de fato APROVADA.
    const [pendente] = await sql<{ id: string }[]>`
      SELECT id FROM ferias_solicitacoes
      WHERE user_id = ${userId} AND tipo = 'FERIAS'
        AND status IN ('PENDENTE', 'APROVADO_GESTOR', 'APROVADO_RH', 'AJUSTE_SUGERIDO')
      LIMIT 1
    `;
    if (pendente) {
      throw new SolicitacaoFeriasPendenteError();
    }

    // Férias APROVADAS (pedido normal ou lançamento manual do RH) com início
    // dentro do MESMO ciclo aquisitivo do pedido atual (`ciclo`, ancorado na
    // data de início solicitada). Sem exceção de fracionamento, UMA já
    // aprovada no ciclo esgota o ciclo (comportamento de sempre). Com a
    // exceção (`pode_fracionar_ferias`), permite uma 2ª — e só uma 2ª —
    // contanto que a já aprovada E esta nova tenham, cada uma, entre
    // DIAS_FRACIONAMENTO_MIN e DIAS_FRACIONAMENTO_MAX dias. Fracionar é
    // OPCIONAL: quem tem a exceção continua podendo pedir um período único
    // de até 30 dias, como quem não tem — só não pode pedir uma 2ª leva
    // fora da faixa 10-15. Sem data de admissão (ciclo null), não dá pra
    // saber os limites do ciclo — cai no comportamento antigo (só a
    // checagem de pendente acima, sem limite de ciclo).
    if (ciclo) {
      const aprovadasNoCiclo = await sql<{ dias: number; dias_vendidos: number }[]>`
        SELECT dias, dias_vendidos FROM ferias_solicitacoes
        WHERE user_id = ${userId} AND tipo = 'FERIAS' AND status = 'APROVADO'
          AND data_inicio BETWEEN ${ciclo.inicio} AND ${ciclo.fim}
        ORDER BY data_inicio
      `;

      if (aprovadasNoCiclo.length > 0) {
        const podeSerA2aLeva =
          u?.pode_fracionar_ferias &&
          aprovadasNoCiclo.length === 1 &&
          aprovadasNoCiclo[0].dias >= DIAS_FRACIONAMENTO_MIN &&
          aprovadasNoCiclo[0].dias <= DIAS_FRACIONAMENTO_MAX;

        if (!podeSerA2aLeva) {
          throw new SolicitacaoFeriasJaAprovadaError();
        }
        if (dias < DIAS_FRACIONAMENTO_MIN || dias > DIAS_FRACIONAMENTO_MAX) {
          throw new SolicitacaoFeriasInvalidaError(
            `Como parte de um fracionamento, cada período deve ter entre ${DIAS_FRACIONAMENTO_MIN} e ${DIAS_FRACIONAMENTO_MAX} dias.`,
          );
        }
      }

      // Teto do ciclo: dias tirados + vendidos (já aprovados + este pedido)
      // não pode passar de 30 — vale sempre, com ou sem as exceções.
      const usadoNoCiclo = aprovadasNoCiclo.reduce(
        (soma, r) => soma + r.dias + r.dias_vendidos,
        0,
      );
      if (usadoNoCiclo + dias + diasVendidos > DIAS_FERIAS_CICLO) {
        throw new SolicitacaoFeriasInvalidaError(
          `O total de dias de férias (tirados + vendidos) não pode passar de ${DIAS_FERIAS_CICLO} no período aquisitivo.`,
        );
      }
    }

    // Antecedência mínima, dia da semana e feriado (só férias).
    validarRegrasFerias(input.dataInicio);
    await validarInicioNaoFeriado(sql, input.dataInicio);
  }

  // Roteamento da 1ª etapa: precisa passar pelo gestor?
  const { gestorId, statusInicial } = await getRoteamentoInicialSolicitacao(sql, userId);

  const [criada] = await sql<{ id: string }[]>`
    INSERT INTO ferias_solicitacoes (
      user_id, tipo, data_inicio, data_fim, dias, dias_vendidos, observacoes,
      periodo_aquisitivo_inicio, periodo_aquisitivo_fim, status
    )
    VALUES (
      ${userId}, ${input.tipo}, ${input.dataInicio}, ${input.dataFim}, ${dias},
      ${diasVendidos}, ${input.observacoes},
      ${ciclo?.inicio ?? null}, ${ciclo?.fim ?? null}, ${statusInicial}
    )
    RETURNING id
  `;

  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${criada.id}
  `;
  return {
    solicitacao: paraDTO(linha),
    statusInicial,
    gestorId,
  };
}

/** Entrada para o RH/Admin registrar manualmente uma férias/folga já ocorrida. */
export interface RegistrarFeriasManualInput {
  usuarioId: string;
  tipo: "FERIAS" | "FOLGA";
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  observacoes: string | null;
}

/**
 * Registra manualmente uma férias/folga que já aconteceu fora do sistema
 * (histórico anterior à implantação, ou lançamento retroativo do RH).
 * Diferente de criarSolicitacao(): nasce já com status APROVADO — não passa
 * pelo fluxo de aprovação, porque representa algo que já foi decidido/já
 * aconteceu — e fica marcada com origem = 'REGISTRO_MANUAL' para diferenciar
 * na tela de quem foi um pedido normal do colaborador. `aprovadorId` aqui é
 * quem FEZ o lançamento (o usuário RH/Admin autenticado), gravado no mesmo
 * campo `aprovado_por` usado pelo fluxo normal de aprovação.
 */
export async function registrarFeriasManual(
  input: RegistrarFeriasManualInput,
  registradoPorId: string,
): Promise<SolicitacaoFeriasDTO> {
  const sql = getDatabase();

  const inicio = new Date(input.dataInicio);
  const fim = new Date(input.dataFim);
  const dias = Math.round((fim.getTime() - inicio.getTime()) / 86_400_000) + 1;

  const [u] = await sql<{ data_admissao: unknown }[]>`
    SELECT data_admissao FROM users WHERE id = ${input.usuarioId} LIMIT 1
  `;
  const ciclo = cicloAquisitivoVigente(paraData(u?.data_admissao));

  const [criada] = await sql<{ id: string }[]>`
    INSERT INTO ferias_solicitacoes (
      user_id, tipo, data_inicio, data_fim, dias, observacoes,
      periodo_aquisitivo_inicio, periodo_aquisitivo_fim,
      status, origem, aprovado_por, decidido_em, confirmado
    )
    VALUES (
      ${input.usuarioId}, ${input.tipo}, ${input.dataInicio}, ${input.dataFim}, ${dias},
      ${input.observacoes},
      ${ciclo?.inicio ?? null}, ${ciclo?.fim ?? null},
      'APROVADO', 'REGISTRO_MANUAL', ${registradoPorId}, NOW(), TRUE
    )
    RETURNING id
  `;

  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${criada.id}
  `;
  return paraDTO(linha);
}

export interface ResultadoSincronizacaoFerias {
  inseridos: number;
  atualizados: number;
  ignorados: number;
}

/**
 * Importa somente o último período passado do APS, sem excluir histórico.
 * Eventos repetidos não duplicam registros; retificações atualizam somente
 * a própria linha importada, nunca solicitações ou lançamentos manuais.
 * O chamador abre a transação; no login, comSavepoint isola falhas do APS.
 */
export async function sincronizarFeriasLegado(
  userId: string,
): Promise<ResultadoSincronizacaoFerias> {
  const sql = getDatabase();
  const [u] = await sql<{ cpf: string | null; data_admissao: unknown }[]>`
    SELECT cpf, data_admissao FROM users WHERE id = ${userId} LIMIT 1
  `;
  const cpf = u?.cpf?.replace(/\D/g, "") ?? "";
  const ignorado = { inseridos: 0, atualizados: 0, ignorados: 1 };
  if (cpf.length !== 11) return ignorado;

  const evento = await buscarUltimaFeriasEsocial(cpf);
  if (!evento?.dataInicio || !evento.dataFim || evento.dataFim < evento.dataInicio) return ignorado;
  // Proteção adicional: nunca importa férias futuras ou em andamento.
  const [hoje] = await sql<{ data: string }[]>`SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS data`;
  if (evento.dataFim >= hoje.data) return ignorado;

  // Serializa sincronizações simultâneas da mesma pessoa (login/script).
  await sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
  const [existente] = await sql<{ id: string; user_id: string; origem: string; status: string }[]>`
    SELECT id, user_id, origem, status FROM ferias_solicitacoes
    WHERE legado_evento_id = ${evento.idEvento}
  `;
  if (existente && (existente.user_id !== userId || existente.origem !== 'REGISTRO_MANUAL' || existente.status !== 'APROVADO')) {
    return ignorado;
  }

  const [sobreposta] = await sql<{ id: string }[]>`
    SELECT id FROM ferias_solicitacoes
    WHERE user_id = ${userId} AND tipo = 'FERIAS'
      AND (${existente?.id ?? null}::uuid IS NULL OR id <> ${existente?.id ?? null})
      AND status NOT IN ('RECUSADO', 'CANCELADO')
      AND daterange(data_inicio, data_fim, '[]')
          && daterange(${evento.dataInicio}::date, ${evento.dataFim}::date, '[]')
    LIMIT 1
  `;
  if (sobreposta) return ignorado;

  const dias = Math.round(
    (new Date(evento.dataFim).getTime() - new Date(evento.dataInicio).getTime()) / 86_400_000,
  ) + 1;
  const ciclo = cicloAquisitivoVigente(paraData(u.data_admissao), new Date(evento.dataInicio));
  const observacoes = `Importado automaticamente do eSocial (evento #${evento.idEvento}).`;
  if (existente) {
    const atualizado = await sql`
      UPDATE ferias_solicitacoes
      SET data_inicio = ${evento.dataInicio}, data_fim = ${evento.dataFim}, dias = ${dias},
          periodo_aquisitivo_inicio = ${ciclo?.inicio ?? null},
          periodo_aquisitivo_fim = ${ciclo?.fim ?? null}, observacoes = ${observacoes}
      WHERE id = ${existente.id}
        AND (data_inicio IS DISTINCT FROM ${evento.dataInicio}::date
          OR data_fim IS DISTINCT FROM ${evento.dataFim}::date OR dias IS DISTINCT FROM ${dias})
    `;
    return atualizado.count > 0 ? { inseridos: 0, atualizados: 1, ignorados: 0 } : ignorado;
  }
  const inserido = await sql`
    INSERT INTO ferias_solicitacoes (
      user_id, tipo, data_inicio, data_fim, dias, observacoes,
      periodo_aquisitivo_inicio, periodo_aquisitivo_fim,
      status, origem, confirmado, legado_evento_id
    ) VALUES (
      ${userId}, 'FERIAS', ${evento.dataInicio}, ${evento.dataFim}, ${dias}, ${observacoes},
      ${ciclo?.inicio ?? null}, ${ciclo?.fim ?? null},
      'APROVADO', 'REGISTRO_MANUAL', TRUE, ${evento.idEvento}
    ) ON CONFLICT (legado_evento_id) DO NOTHING
  `;
  return inserido.count > 0 ? { inseridos: 1, atualizados: 0, ignorados: 0 } : ignorado;
}

/** Recarrega e mapeia a solicitação após um UPDATE. */
async function recarregarDTO(
  sql: ReturnType<typeof postgres>,
  id: string,
): Promise<SolicitacaoFeriasDTO | null> {
  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${id}
  `;
  return linha ? paraDTO(linha) : null;
}

/**
 * 1ª etapa — chefia aprova: PENDENTE → RH ou Assistente (solicitante RH).
 * Retorna null se a solicitação não existir ou não estiver mais PENDENTE.
 */
export async function aprovarSolicitacao(
  id: string,
  gestorId: string,
): Promise<SolicitacaoFeriasDTO | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE ferias_solicitacoes f
    SET status = ${statusAposChefiaSql(sql)},
        aprovado_gestor_por = ${gestorId}, aprovado_gestor_em = NOW(),
        motivo_recusa = NULL
    FROM users u
    WHERE f.id = ${id} AND f.user_id = u.id AND f.status = 'PENDENTE'
  `;
  if (atualizado.count === 0) return null;
  return recarregarDTO(sql, id);
}

/** 2ª etapa: RH analisa os demais solicitantes e encaminha ao Assistente. */
export async function aprovarRhSolicitacao(
  id: string,
  rhId: string,
): Promise<SolicitacaoFeriasDTO | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE ferias_solicitacoes
    SET status = 'APROVADO_RH', aprovado_rh_por = ${rhId},
        aprovado_rh_em = NOW(), motivo_recusa = NULL
    WHERE id = ${id} AND status = 'APROVADO_GESTOR'
  `;
  if (atualizado.count === 0) return null;
  return recarregarDTO(sql, id);
}

/** Etapa final: Assistente confirma, após o RH ou o desvio do solicitante RH. */
export async function confirmarSolicitacao(
  id: string,
  assistenteId: string,
): Promise<SolicitacaoFeriasDTO | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE ferias_solicitacoes
    SET status = 'APROVADO', aprovado_por = ${assistenteId},
        decidido_em = NOW(), confirmado = TRUE, motivo_recusa = NULL
    WHERE id = ${id} AND status = 'APROVADO_RH'
  `;
  if (atualizado.count === 0) return null;
  return recarregarDTO(sql, id);
}

/**
 * Deslocamento máximo (em dias, pra antes ou depois) que o RH pode sugerir
 * pro início do período — mesmo valor do CHECK `ferias_ajuste_dentro_do_limite`
 * (017_ferias_ajuste_dp.sql). Validado aqui também pra devolver uma mensagem
 * amigável em vez de deixar estourar a constraint do banco.
 */
const LIMITE_AJUSTE_DP_DIAS = 5;

/**
 * 2ª etapa (alternativa à aprovação) — o RH devolve ao colaborador uma
 * sugestão de novo início, deslocando o período em até LIMITE_AJUSTE_DP_DIAS
 * dias (mantém a mesma duração): APROVADO_GESTOR → AJUSTE_SUGERIDO.
 * Retorna null se não existir ou não estiver em APROVADO_GESTOR.
 */
export async function sugerirAjusteSolicitacao(
  id: string,
  dpId: string,
  novoInicioISO: string,
  motivo: string,
): Promise<SolicitacaoFeriasDTO | null> {
  const sql = getDatabase();
  const [atual] = await sql<{ data_inicio: unknown; dias: number; status: StatusDB }[]>`
    SELECT data_inicio, dias, status FROM ferias_solicitacoes WHERE id = ${id} LIMIT 1
  `;
  if (!atual || atual.status !== "APROVADO_GESTOR") return null;

  const inicioAtual = paraData(atual.data_inicio);
  if (!inicioAtual) return null;
  const novoInicio = dataLocalDeISO(novoInicioISO);

  const deslocamento = Math.round(
    (novoInicio.getTime() - inicioAtual.getTime()) / 86_400_000,
  );
  if (Math.abs(deslocamento) > LIMITE_AJUSTE_DP_DIAS) {
    throw new SolicitacaoFeriasInvalidaError(
      `O ajuste pode deslocar o período em no máximo ${LIMITE_AJUSTE_DP_DIAS} dias.`,
    );
  }

  const novoFim = new Date(novoInicio);
  novoFim.setDate(novoFim.getDate() + (atual.dias - 1));
  const novoFimISO = novoFim.toISOString().slice(0, 10);

  const atualizado = await sql`
    UPDATE ferias_solicitacoes
    SET status = 'AJUSTE_SUGERIDO',
        data_inicio_sugerida = ${novoInicioISO},
        data_fim_sugerida = ${novoFimISO},
        ajuste_sugerido_por = ${dpId}, ajuste_sugerido_em = NOW(),
        motivo_ajuste = ${motivo}
    WHERE id = ${id} AND status = 'APROVADO_GESTOR'
  `;
  if (atualizado.count === 0) return null;
  return recarregarDTO(sql, id);
}

/** Resultado de aceitarAjusteSolicitacao — inclui o roteamento da notificação. */
export interface AceitarAjusteResultado {
  solicitacao: SolicitacaoFeriasDTO;
  /** Status resultante conforme chefia e papel do solicitante. */
  statusInicial: StatusInicialSolicitacao;
  /** Gestor a notificar; null quando caiu no fallback (notificar RH ou Assistente). */
  gestorId: string | null;
}

/**
 * O colaborador aceita o ajuste sugerido pelo RH: aplica a data sugerida
 * como o período oficial e REINICIA o fluxo de aprovação (mesmo fallback de
 * criarSolicitacao: passa pela chefia quando houver; sem chefia segue ao
 * RH, ou ao Assistente quando o solicitante é RH. Limpa as aprovações
 * anteriores para que o novo período passe pelas etapas aplicáveis.
 *
 * Não existe uma "recusa do ajuste" — se o colaborador não concorda, cancela
 * a solicitação inteira (ação já existente).
 *
 * Retorna null se não existir, não for o dono, ou não estiver em
 * AJUSTE_SUGERIDO.
 */
export async function aceitarAjusteSolicitacao(
  id: string,
  userId: string,
): Promise<AceitarAjusteResultado | null> {
  const sql = getDatabase();
  const [atual] = await sql<{
    user_id: string;
    status: StatusDB;
    data_inicio_sugerida: unknown;
    data_fim_sugerida: unknown;
  }[]>`
    SELECT user_id, status, data_inicio_sugerida, data_fim_sugerida
    FROM ferias_solicitacoes WHERE id = ${id} LIMIT 1
  `;
  if (!atual || atual.user_id !== userId || atual.status !== "AJUSTE_SUGERIDO") {
    return null;
  }

  const novoInicio = paraData(atual.data_inicio_sugerida);
  const novoFim = paraData(atual.data_fim_sugerida);
  if (!novoInicio || !novoFim) return null;
  const dias = Math.round((novoFim.getTime() - novoInicio.getTime()) / 86_400_000) + 1;

  const { gestorId, statusInicial } = await getRoteamentoInicialSolicitacao(sql, userId);

  const atualizado = await sql`
    UPDATE ferias_solicitacoes
    SET data_inicio = data_inicio_sugerida,
        data_fim = data_fim_sugerida,
        dias = ${dias},
        status = ${statusInicial},
        data_inicio_sugerida = NULL, data_fim_sugerida = NULL,
        ajuste_sugerido_por = NULL, ajuste_sugerido_em = NULL, motivo_ajuste = NULL,
        aprovado_gestor_por = NULL, aprovado_gestor_em = NULL,
        aprovado_rh_por = NULL, aprovado_rh_em = NULL,
        aprovado_por = NULL, decidido_em = NULL, confirmado = FALSE, motivo_recusa = NULL
    WHERE id = ${id} AND status = 'AJUSTE_SUGERIDO'
  `;
  if (atualizado.count === 0) return null;

  const dto = await recarregarDTO(sql, id);
  if (!dto) return null;
  return { solicitacao: dto, statusInicial, gestorId };
}

/**
 * Recusa com justificativa. Pode ser feita pelo gestor (em PENDENTE) ou pelo
 * RH (APROVADO_GESTOR) ou Tesoureiro Assistente (APROVADO_RH). Retorna o DTO ou null se não estava recusável.
 */
export async function recusarSolicitacao(
  id: string,
  quemId: string,
  motivo: string,
  statusEsperado: "PENDENTE" | "APROVADO_GESTOR" | "APROVADO_RH",
): Promise<SolicitacaoFeriasDTO | null> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE ferias_solicitacoes
    SET status = 'RECUSADO', aprovado_por = ${quemId},
        decidido_em = NOW(), motivo_recusa = ${motivo}
    WHERE id = ${id} AND status = ${statusEsperado}
  `;
  if (atualizado.count === 0) return null;
  return recarregarDTO(sql, id);
}

/** Resultado do cancelamento — distingue "não pode" de "não existe". */
export type ResultadoCancelamento =
  | { ok: true; solicitacao: SolicitacaoFeriasDTO }
  | { ok: false; motivo: "NAO_ENCONTRADA" | "SEM_PERMISSAO" };

/**
 * Cancela uma solicitação:
 *   - o COLABORADOR dono cancela enquanto PENDENTE, APROVADO_GESTOR, APROVADO_RH ou AJUSTE_SUGERIDO;
 *   - RH/Assistente/ADMIN cancela também quando já APROVADO.
 * `ehGestaoOuAdmin` vem da rota (papel do usuário). Grava quem/quando/motivo.
 */
export async function cancelarSolicitacao(
  id: string,
  quemId: string,
  ehGestaoOuAdmin: boolean,
  motivo: string | null,
): Promise<ResultadoCancelamento> {
  const sql = getDatabase();
  const [atual] = await sql<{ user_id: string; status: StatusDB }[]>`
    SELECT user_id, status FROM ferias_solicitacoes WHERE id = ${id} LIMIT 1
  `;
  if (!atual) return { ok: false, motivo: "NAO_ENCONTRADA" };

  const ehDono = atual.user_id === quemId;
  const emAndamento =
    atual.status === "PENDENTE" ||
    atual.status === "APROVADO_GESTOR" ||
    atual.status === "APROVADO_RH" ||
    // Se o colaborador não concorda com o ajuste sugerido pelo RH, cancela a
    // solicitação inteira — não existe uma "recusa do ajuste" separada.
    atual.status === "AJUSTE_SUGERIDO";

  // Dono cancela enquanto em andamento; RH/Assistente/ADMIN cancela em andamento ou já aprovado.
  const podeDono = ehDono && emAndamento;
  const podeGestao = ehGestaoOuAdmin && (emAndamento || atual.status === "APROVADO");
  if (!podeDono && !podeGestao) return { ok: false, motivo: "SEM_PERMISSAO" };

  await sql`
    UPDATE ferias_solicitacoes
    SET status = 'CANCELADO', cancelado_por = ${quemId},
        cancelado_em = NOW(), motivo_cancelamento = ${motivo}
    WHERE id = ${id}
  `;
  const dto = await recarregarDTO(sql, id);
  return dto
    ? { ok: true, solicitacao: dto }
    : { ok: false, motivo: "NAO_ENCONTRADA" };
}

/** Resultado da exclusão — distingue os motivos de falha pra rota devolver o status certo. */
export type ResultadoExclusao =
  | { ok: true }
  | { ok: false; motivo: "NAO_ENCONTRADA" | "SEM_PERMISSAO" | "NAO_CANCELADA" };

/**
 * Exclui definitivamente uma solicitação. Regra: só o próprio dono exclui, e
 * só depois de CANCELADA (mesma trava aplicada no front — precisa cancelar
 * antes de poder excluir) — evita apagar histórico de algo ainda em
 * andamento ou já aprovado/recusado sem passar por cancelamento primeiro.
 *
 * ADMIN pula as duas travas (dono e status) — útil pra limpar um lançamento
 * errado (manual ou importado) sem precisar cancelar primeiro, mesmo que não
 * seja o próprio. A policy de RLS (027_ferias_excluir_admin.sql) já libera
 * ADMIN pra apagar qualquer linha; esta checagem aqui é só a regra de
 * negócio em cima disso (mesma divisão de responsabilidade do resto do
 * arquivo: RLS decide QUEM, a API decide EM QUE CONDIÇÃO).
 */
export async function excluirSolicitacao(
  id: string,
  userId: string,
  ehAdmin: boolean,
): Promise<ResultadoExclusao> {
  const sql = getDatabase();
  const [atual] = await sql<{ user_id: string; status: StatusDB }[]>`
    SELECT user_id, status FROM ferias_solicitacoes WHERE id = ${id} LIMIT 1
  `;
  if (!atual) return { ok: false, motivo: "NAO_ENCONTRADA" };
  if (!ehAdmin) {
    if (atual.user_id !== userId) return { ok: false, motivo: "SEM_PERMISSAO" };
    if (atual.status !== "CANCELADO") return { ok: false, motivo: "NAO_CANCELADA" };
  }

  // notificacoes aponta pra cá por referencia_tabela/referencia_id, sem FK
  // (ponteiro solto, ver 009_notificacoes.sql) — sem isso, a notificação
  // fica órfã pra sempre na lista (só perde o botão de ação, não some).
  await sql`
    DELETE FROM notificacoes
    WHERE referencia_tabela = 'ferias_solicitacoes' AND referencia_id = ${id}
  `;
  await sql`DELETE FROM ferias_solicitacoes WHERE id = ${id}`;
  return { ok: true };
}

/* ── Visões (gestor / DP / RH) e lembretes ────────────────────────────────── */

/**
 * Férias da EQUIPE de um gestor (setor cujo gestor_id = gestorId), em andamento
 * ou já confirmadas — para o dialog "Calendário da equipe" (evitar conflitos).
 */
export async function listSolicitacoesEquipe(
  gestorId: string,
): Promise<SolicitacaoFeriasDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)}
    WHERE f.tipo = 'FERIAS'
      AND f.status IN ('APROVADO_GESTOR', 'APROVADO_RH', 'APROVADO')
      AND u.setor_id IN (SELECT id FROM setor WHERE gestor_id = ${gestorId})
    ORDER BY f.data_inicio ASC
  `;
  return linhas.map(paraDTO);
}

/** Colaborador que precisa tirar férias (ciclo perto de fechar, sem pedido). */
export interface ColaboradorPendenteFeriasDTO {
  userId: string;
  nome: string;
  avatarUrl: string;
  iniciais: string;
  setor: string | null;
  cicloFim: string;
  diasParaFimDoCiclo: number;
}

/** Visão geral do DP/RH: quem vai entrar de férias e quem precisa tirar. */
export interface VisaoGeralFeriasDTO {
  vaoEntrar: SolicitacaoFeriasDTO[];
  precisamTirar: ColaboradorPendenteFeriasDTO[];
}

/** Faltam quantos dias (a partir de hoje) até um "YYYY-MM-DD". */
function diasAte(iso: string): number {
  const alvo = dataLocalDeISO(iso);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

/**
 * Janela (em dias) antes do fim do ciclo aquisitivo em que o colaborador passa
 * a ser lembrado/listado como "precisa tirar férias".
 */
const LIMIAR_LEMBRETE_DIAS = 60;

/**
 * Visão geral para DP/RH. `mes` (YYYY-MM) filtra "vão entrar" por mês de
 * início; sem `mes`, lista as férias aprovadas a partir de hoje.
 */
export async function listVisaoGeral(
  mes?: string,
): Promise<VisaoGeralFeriasDTO> {
  const sql = getDatabase();

  const linhas = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)}
    WHERE f.tipo = 'FERIAS' AND f.status = 'APROVADO'
      ${
        mes
          ? sql`AND to_char(f.data_inicio, 'YYYY-MM') = ${mes}`
          : sql`AND f.data_inicio >= CURRENT_DATE`
      }
    ORDER BY f.data_inicio ASC
  `;
  const vaoEntrar = linhas.map(paraDTO);

  // "Precisam tirar": ativos com data de admissão cujo ciclo aquisitivo fecha
  // em ≤ LIMIAR_LEMBRETE_DIAS e que não têm FERIAS em andamento/aprovada no
  // ciclo vigente. Candidatos costumam ser poucos (janela curta) — checagem
  // por colaborador é aceitável.
  const candidatos = await sql<
    {
      id: string;
      nome: string;
      avatar_url: string | null;
      data_admissao: unknown;
      setor: string | null;
    }[]
  >`
    SELECT u.id, u.nome, u.avatar_url, u.data_admissao, s.nome AS setor
    FROM users u
    LEFT JOIN setor s ON s.id = u.setor_id
    WHERE u.is_active = TRUE AND u.data_admissao IS NOT NULL
  `;

  const precisamTirar: ColaboradorPendenteFeriasDTO[] = [];
  for (const c of candidatos) {
    const ciclo = cicloAquisitivoVigente(paraData(c.data_admissao));
    if (!ciclo) continue;
    const dias = diasAte(ciclo.fim);
    if (dias < 0 || dias > LIMIAR_LEMBRETE_DIAS) continue;

    const [temPedido] = await sql<{ id: string }[]>`
      SELECT id FROM ferias_solicitacoes
      WHERE user_id = ${c.id} AND tipo = 'FERIAS'
        AND status IN ('PENDENTE', 'APROVADO_GESTOR', 'APROVADO_RH', 'APROVADO')
        AND data_inicio BETWEEN ${ciclo.inicio} AND ${ciclo.fim}
      LIMIT 1
    `;
    if (temPedido) continue;

    precisamTirar.push({
      userId: c.id,
      nome: c.nome,
      avatarUrl: montarAvatarUrl(c.id, c.avatar_url),
      iniciais: gerarIniciais(c.nome),
      setor: c.setor,
      cicloFim: formatarPeriodoResumo(ciclo.fim),
      diasParaFimDoCiclo: dias,
    });
  }
  precisamTirar.sort((a, b) => a.diasParaFimDoCiclo - b.diasParaFimDoCiclo);

  return { vaoEntrar, precisamTirar };
}

/**
 * Obrigação recorrente "solicitar férias" (ver lib/obrigacoes.ts) — verifica
 * se o colaborador AINDA NÃO solicitou férias para o ciclo aquisitivo
 * vigente (calculado a partir de `users.data_admissao`). Diferente do antigo
 * `avaliarLembreteCiclo` (removido): não espera estar perto do fim do ciclo —
 * cobre o ciclo inteiro, do início ao fim, porque é tratado como uma
 * obrigação do colaborador, não um lembrete de prazo.
 *
 * Retorna `null` quando a obrigação está cumprida (já tem uma solicitação em
 * andamento ou aprovada no ciclo) ou quando não dá pra calcular o ciclo (sem
 * data de admissão) — em qualquer um dos dois casos, `avaliarObrigacoesRecorrentes`
 * não emite nada.
 */
export async function verificarObrigacaoFerias(
  userId: string,
): Promise<{ acao: string; detalhe: string } | null> {
  const sql = getDatabase();

  const [u] = await sql<{ data_admissao: unknown }[]>`
    SELECT data_admissao FROM users WHERE id = ${userId} LIMIT 1
  `;
  const ciclo = cicloAquisitivoVigente(paraData(u?.data_admissao));
  if (!ciclo) return null;

  // Já solicitou (em andamento, aguardando ajuste, ou já aprovada) neste
  // ciclo? Obrigação cumprida — inclui AJUSTE_SUGERIDO (o colaborador ainda
  // precisa aceitar/cancelar, mas já agiu, não precisa cutucar de novo).
  const [pedido] = await sql<{ id: string }[]>`
    SELECT id FROM ferias_solicitacoes
    WHERE user_id = ${userId} AND tipo = 'FERIAS'
      AND status IN ('PENDENTE', 'APROVADO_GESTOR', 'APROVADO_RH', 'AJUSTE_SUGERIDO', 'APROVADO')
      AND data_inicio BETWEEN ${ciclo.inicio} AND ${ciclo.fim}
    LIMIT 1
  `;
  if (pedido) return null;

  const dias = diasAte(ciclo.fim);
  return {
    acao: "Você ainda não solicitou suas férias",
    detalhe: `Você tem ${dias === 1 ? "1 dia" : `${dias} dias`} para solicitar suas férias na aba Férias.`,
  };
}

/** Dados de uma solicitação para emitir notificações (dono + resumo). */
export async function getSolicitacaoParaNotificar(id: string): Promise<{
  status: StatusDB;
  userId: string;
  funcionarioNome: string;
  funcionarioEmail: string;
  periodo: string;
  dias: number;
  /** Papel do solicitante (informativo). */
  solicitantePapel: string | null;
  responsavelPrimeiraEtapaId: string | null;
  /** FERIAS ou FOLGA — pro texto/ícone da notificação dizer qual dos dois é. */
  tipo: "FERIAS" | "FOLGA";
} | null> {
  const sql = getDatabase();
  const [linha] = await sql<LinhaSolicitacao[]>`
    ${SELECT_SOLICITACAO(sql)} WHERE f.id = ${id}
  `;
  if (!linha) return null;
  const inicio = paraData(linha.data_inicio) ?? new Date();
  const fim = paraData(linha.data_fim) ?? inicio;
  return {
    status: linha.status,
    userId: linha.userId,
    funcionarioNome: linha.funcionarioNome,
    funcionarioEmail: linha.funcionarioEmail,
    periodo: formatarPeriodo(inicio, fim),
    dias: linha.dias,
    solicitantePapel: linha.solicitantePapel,
    responsavelPrimeiraEtapaId: linha.responsavelPrimeiraEtapaId,
    tipo: linha.tipo,
  };
}

/* ── Exceções de férias (fracionamento/venda) — tela do DP ──────────────── */

/** Um usuário na tela "Exceções" — só o essencial pra listar/alternar. */
export interface ExcecaoFeriasDTO {
  id: string;
  nome: string;
  setor: string;
  avatarUrl: string;
  iniciais: string;
  podeFracionarFerias: boolean;
  podeVenderFerias: boolean;
}

/** Entrada para atualizar as exceções de um usuário. */
export interface AtualizarExcecaoFeriasInput {
  podeFracionarFerias: boolean;
  podeVenderFerias: boolean;
}

/** Linha crua da tela de exceções (antes de resolver avatar/iniciais). */
interface LinhaExcecaoFerias {
  id: string;
  nome: string;
  setor: string;
  avatar_url: string | null;
  podeFracionarFerias: boolean;
  podeVenderFerias: boolean;
}

/** Converte a linha crua no DTO (resolve avatarUrl/iniciais). */
function paraExcecaoDTO(linha: LinhaExcecaoFerias): ExcecaoFeriasDTO {
  return {
    id: linha.id,
    nome: linha.nome,
    setor: linha.setor,
    avatarUrl: montarAvatarUrl(linha.id, linha.avatar_url),
    iniciais: gerarIniciais(linha.nome),
    podeFracionarFerias: linha.podeFracionarFerias,
    podeVenderFerias: linha.podeVenderFerias,
  };
}

/**
 * Lista os colaboradores ativos com o estado das duas exceções de férias
 * (fracionar/vender — ver 024_ferias_excecoes.sql). Deliberadamente mais
 * leve que a listagem completa de usuários (sem os ~20 campos de
 * SELECT_USUARIO_DETALHADO) — essa tela só precisa de nome/foto/setor + as flags.
 */
export async function listExcecoesFerias(): Promise<ExcecaoFeriasDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaExcecaoFerias[]>`
    SELECT u.id, u.nome, COALESCE(s.nome, '') AS setor, u.avatar_url,
           u.pode_fracionar_ferias AS "podeFracionarFerias",
           u.pode_vender_ferias    AS "podeVenderFerias"
    FROM users u
    LEFT JOIN setor s ON s.id = u.setor_id
    WHERE u.is_active
    ORDER BY u.nome
  `;
  return linhas.map(paraExcecaoDTO);
}

/**
 * Atualiza as exceções de férias de um usuário (DP/COORDENADOR DP/ADMIN, ver
 * a rota). Retorna null se o id não existir.
 */
export async function atualizarExcecaoFerias(
  usuarioId: string,
  input: AtualizarExcecaoFeriasInput,
): Promise<ExcecaoFeriasDTO | null> {
  const sql = getDatabase();
  const [atualizado] = await sql<LinhaExcecaoFerias[]>`
    UPDATE users SET
      pode_fracionar_ferias = ${input.podeFracionarFerias},
      pode_vender_ferias    = ${input.podeVenderFerias}
    WHERE id = ${usuarioId}
    RETURNING id, nome,
      COALESCE((SELECT s.nome FROM setor s WHERE s.id = users.setor_id), '') AS setor,
      avatar_url,
      pode_fracionar_ferias AS "podeFracionarFerias",
      pode_vender_ferias    AS "podeVenderFerias"
  `;
  return atualizado ? paraExcecaoDTO(atualizado) : null;
}
