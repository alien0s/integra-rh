import postgres from "postgres";

import { getDatabase } from "./database.js";

/** Alias curto: aceita tanto a conexão normal quanto uma transação (sql.begin). */
type Sql = postgres.ISql;

/** Lançado quando o vrMesId informado não existe. A rota converte isso num 404. */
export class VrMesNaoEncontradoError extends Error {
  constructor(vrMesId: string) {
    super(`vr_mes ${vrMesId} não encontrado`);
    this.name = "VrMesNaoEncontradoError";
  }
}

/**
 * Lançado ao tentar editar um mês que já tem pelo menos 1 entidade fechada
 * (mudar os dias elegíveis invalidaria o cálculo já feito). A rota converte
 * isso num 409.
 */
export class VrMesJaFechadoError extends Error {
  constructor(vrMesId: string) {
    super(`vr_mes ${vrMesId} já tem pelo menos 1 entidade fechada e não pode mais ser editado`);
    this.name = "VrMesJaFechadoError";
  }
}

/** Lançado ao tentar cadastrar um mês (mes/ano) que já existe. A rota converte isso num 409. */
export class VrMesJaExisteError extends Error {
  constructor(mes: number, ano: number) {
    super(`Já existe um vr_mes cadastrado para ${mes}/${ano}`);
    this.name = "VrMesJaExisteError";
  }
}

/**
 * Lançado ao tentar cadastrar um mês novo enquanto já existe outro mês
 * aberto (fechado = FALSE). Só pode ter 1 mês aberto por vez. A rota
 * converte isso num 409.
 */
export class VrMesAbertoExistenteError extends Error {
  constructor(mes: number, ano: number, grupo: string) {
    super(
      `Já existe um mês aberto no grupo ${grupo} (${mes}/${ano}) — feche todas as entidades dele antes de cadastrar outro mês`,
    );
    this.name = "VrMesAbertoExistenteError";
  }
}

/** Lançado ao tentar cadastrar um mês sem nenhum dia elegível marcado. A rota converte isso num 400. */
export class VrMesSemDiasElegiveisError extends Error {
  constructor() {
    super("É preciso marcar pelo menos 1 dia elegível no calendário");
    this.name = "VrMesSemDiasElegiveisError";
  }
}

/** Lançado ao tentar fechar uma entidade que já está fechada nesse mês. A rota converte isso num 409. */
export class EntidadeJaFechadaError extends Error {
  constructor(entityNome: string) {
    super(`${entityNome} já está fechada neste mês`);
    this.name = "EntidadeJaFechadaError";
  }
}

/** Lançado ao tentar fechar uma entidade marcada como participa_vr = FALSE. A rota converte isso num 400. */
export class EntidadeNaoParticipaVrError extends Error {
  constructor(entityNome: string) {
    super(`${entityNome} não participa do Vale-Refeição`);
    this.name = "EntidadeNaoParticipaVrError";
  }
}

/**
 * Lançado ao tentar lançar desconto/extra pra alguém de uma entidade que já
 * fechou o mês. A rota converte isso num 409.
 */
export class EntidadeFechadaNaoAceitaLancamentoError extends Error {
  constructor(entityNome: string) {
    super(`${entityNome} já fechou este mês — não é possível lançar novos descontos/extras`);
    this.name = "EntidadeFechadaNaoAceitaLancamentoError";
  }
}

/**
 * Módulo de Vale-Refeição (VR) — fechamento mensal, POR ENTIDADE.
 *
 * Regra de negócio (confirmada com o time de DP):
 * - dias_vr = dias_base + qtd_extra - qtd_desconto (nunca negativo)
 * - dias_base, valor_diario e valor_diario_aprendiz são ÚNICOS pra empresa
 *   toda (vr_mes) — não variam por entidade.
 * - O FECHAMENTO em si é independente por entidade (ACeAm, RADOAM, NT
 *   Store...): cada auxiliar do DP fecha e gera os arquivos só da sua
 *   entidade, em momentos diferentes das outras (vr_fechamento_entidade).
 * - Quando TODAS as entidades com colaboradores ativos já fecharam, o
 *   vr_mes inteiro é marcado como fechado (fechado = true) — isso só
 *   bloqueia edição do calendário/valores, não afeta o fechamento em si
 *   (que já aconteceu entidade por entidade).
 * - Excedente de desconto (quando descontos pendentes > dias-base + extras):
 *   o excesso fica pendente e migra para o vr_mes seguinte, priorizando os
 *   lançamentos mais ANTIGOS (data_desconto) para aplicação neste mês —
 *   ou seja, FIFO: quem está esperando há mais tempo é descontado primeiro.
 * - Se o vr_mes seguinte ainda não existir quando precisar migrar um
 *   excedente, ele é CRIADO automaticamente (copiando os valores diários
 *   do mês atual) — mas o calendário de dias elegíveis (vr_dia_elegivel)
 *   desse mês criado ainda precisa ser cadastrado manualmente depois.
 */

/* ── Tipos expostos ────────────────────────────────────────────────────── */

export interface FechamentoVrResultado {
  vrMesId: string;
  entityId: string;
  entityNome: string;
  registrosGerados: number;
  lancamentosAplicados: number;
  lancamentosPendentesProximoMes: number;
  /** true quando essa foi a última entidade pendente — o mês inteiro fechou. */
  mesInteiroFechado: boolean;
}

/** Resumo de um mês de VR, para a lista/tela de cadastro. */
export interface VrMesResumo {
  id: string;
  /** Grupo (campo) dono do mês: ACeAm, ANRA... */
  grupo: string;
  mes: number;
  ano: number;
  fechado: boolean;
  valorDiario: number;
  valorDiarioAprendiz: number;
  diasElegiveis: number;
}

/** Entrada para cadastrar um novo mês de VR. */
export interface CriarVrMesInput {
  /** Grupo do mês. Admin informa; os demais usam sempre o grupo da própria entidade. */
  grupo: string;
  mes: number;
  ano: number;
  valorDiario: number;
  valorDiarioAprendiz: number;
  /** Datas ISO ("YYYY-MM-DD") dos dias elegíveis, marcadas manualmente no calendário. */
  diasElegiveis: string[];
}

/** Entidade (empresa/organização) simples, pra dropdowns. */
export interface EntidadeOpcao {
  id: string;
  nome: string;
  grupo: string | null;
}

/** Status de fechamento de 1 entidade dentro de 1 mês. */
export interface StatusFechamentoEntidade {
  entityId: string;
  entityNome: string;
  fechado: boolean;
  fechadoEm: string | null;
}

/* ── Tipos internos / linhas cruas do banco ───────────────────────────── */

interface LinhaVrMes {
  id: string;
  grupo: string;
  mes: number;
  ano: number;
  fechado: boolean;
  valorDiario: number;
  valorDiarioAprendiz: number;
}

interface UsuarioElegivel {
  id: string;
  /**
   * Categoria Aprendiz/Estagiário resolvida por users.tipo_funcionario.
   * Valor confirmado no banco: 'APRENDIZ/ESTAGIÁRIO' (colaboradores comuns
   * ficam como 'COLABORADOR').
   */
  isAprendiz: boolean;
  nome: string;
  email: string;
  entityId: string;
}

/** Valor de users.tipo_funcionario que identifica Aprendiz/Estagiário. */
const TIPO_FUNCIONARIO_APRENDIZ = "APRENDIZ/ESTAGIÁRIO";

interface LancamentoPendente {
  id: string;
  tipoLancamento: "DESCONTO" | "EXTRA";
  dataDesconto: unknown;
}

/* ── Consultas auxiliares ──────────────────────────────────────────────── */

/** Busca o vr_mes com FOR UPDATE (trava a linha durante o fechamento). */
async function buscarVrMesParaFechamento(
  sql: Sql,
  vrMesId: string,
): Promise<LinhaVrMes | null> {
  const [linha] = await sql<LinhaVrMes[]>`
    SELECT id, grupo, mes, ano, fechado,
           valor_diario::float8          AS "valorDiario",
           valor_diario_aprendiz::float8 AS "valorDiarioAprendiz"
    FROM vr_mes
    WHERE id = ${vrMesId}
    FOR UPDATE
  `;
  return linha ?? null;
}

/** Conta os dias elegíveis cadastrados para o mês (dias-base, igual para todos). */
async function contarDiasBase(sql: Sql, vrMesId: string): Promise<number> {
  const [{ total }] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total FROM vr_dia_elegivel WHERE vr_mes_id = ${vrMesId}
  `;
  return total;
}

/**
 * Resolve o vr_mes seguinte (mês+1, ou ano+1/mês 1). Se ainda não existir,
 * CRIA automaticamente copiando os valores diários do mês atual.
 */
async function garantirProximoVrMes(
  sql: Sql,
  mesAtual: number,
  anoAtual: number,
  grupo: string,
  valorDiario: number,
  valorDiarioAprendiz: number,
): Promise<{ id: string }> {
  const proximoMes = mesAtual === 12 ? 1 : mesAtual + 1;
  const proximoAno = mesAtual === 12 ? anoAtual + 1 : anoAtual;

  const [existente] = await sql<{ id: string }[]>`
    SELECT id FROM vr_mes
    WHERE mes = ${proximoMes} AND ano = ${proximoAno} AND grupo = ${grupo}
    LIMIT 1
  `;
  if (existente) return existente;

  const [criado] = await sql<{ id: string }[]>`
    INSERT INTO vr_mes (mes, ano, grupo, valor_diario, valor_diario_aprendiz)
    VALUES (${proximoMes}, ${proximoAno}, ${grupo}, ${valorDiario}, ${valorDiarioAprendiz})
    RETURNING id
  `;
  return criado;
}

/**
 * Lista os usuários ativos elegíveis ao benefício. `entityId` restringe a 1
 * entidade; `grupo` restringe aos colaboradores de entidades daquele grupo
 * (campo) — fechamento e pré-visualização sempre passam o grupo do mês.
 */
async function listarUsuariosElegiveis(
  sql: Sql,
  entityId?: string,
  grupo?: string,
): Promise<UsuarioElegivel[]> {
  const filtroEntidade = entityId ? sql`AND u.entity_id = ${entityId}` : sql``;
  const filtroGrupo = grupo ? sql`AND e.grupo = ${grupo}` : sql``;
  const linhas = await sql<
    { id: string; nome: string; email: string; entityId: string; tipoFuncionario: string | null }[]
  >`
    SELECT u.id, u.nome, u.email, u.entity_id AS "entityId", u.tipo_funcionario AS "tipoFuncionario"
    FROM users u
    JOIN entities e ON e.id = u.entity_id
    WHERE u.is_active = TRUE AND u.participa_vr = TRUE
      ${filtroEntidade} ${filtroGrupo}
    ORDER BY u.nome
  `;
  return linhas.map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    entityId: linha.entityId,
    isAprendiz: linha.tipoFuncionario === TIPO_FUNCIONARIO_APRENDIZ,
  }));
}

/** Lançamentos pendentes de um usuário para este mês, mais antigos primeiro (FIFO). */
async function listarLancamentosPendentes(
  sql: Sql,
  vrMesId: string,
  userId: string,
): Promise<LancamentoPendente[]> {
  return sql<LancamentoPendente[]>`
    SELECT id, tipo_lancamento AS "tipoLancamento", data_desconto AS "dataDesconto"
    FROM vr_lancamento
    WHERE mes_descontar_valor_id = ${vrMesId}
      AND user_id = ${userId}
      AND desconto_aplicado = FALSE
    ORDER BY data_desconto ASC
  `;
}

/** Info básica do vr_mes (usada, por ex., pra montar o nome do arquivo de download). */
export async function buscarVrMesInfo(
  vrMesId: string,
): Promise<{ id: string; mes: number; ano: number; fechado: boolean } | null> {
  const sql = getDatabase();
  const [linha] = await sql<{ id: string; mes: number; ano: number; fechado: boolean }[]>`
    SELECT id, mes, ano, fechado FROM vr_mes WHERE id = ${vrMesId} LIMIT 1
  `;
  return linha ?? null;
}

/**
 * Lista os meses de VR, mais recentes primeiro. `grupo` undefined = todos os
 * grupos (só ADMIN); string/null = só daquele grupo.
 */
export async function listarVrMeses(grupo?: string | null): Promise<VrMesResumo[]> {
  const sql = getDatabase();
  const filtro = grupo === undefined ? sql`` : sql`WHERE m.grupo = ${grupo}`;
  return sql<VrMesResumo[]>`
    SELECT
      m.id, m.grupo, m.mes, m.ano, m.fechado,
      m.valor_diario::float8          AS "valorDiario",
      m.valor_diario_aprendiz::float8 AS "valorDiarioAprendiz",
      COUNT(d.id)::int                AS "diasElegiveis"
    FROM vr_mes m
    LEFT JOIN vr_dia_elegivel d ON d.vr_mes_id = m.id
    ${filtro}
    GROUP BY m.id
    ORDER BY m.ano DESC, m.mes DESC, m.grupo
  `;
}

/**
 * Cadastra um novo mês de VR: valores diários + calendário de dias elegíveis
 * (marcados manualmente pelo DP). Roda numa transação — se falhar no meio,
 * nada fica salvo pela metade.
 */
export async function criarVrMes(input: CriarVrMesInput): Promise<VrMesResumo> {
  if (input.diasElegiveis.length === 0) {
    throw new VrMesSemDiasElegiveisError();
  }

  const sql = getDatabase();

  return sql.begin(async (sql: postgres.TransactionSql) => {
    const [grupoValido] = await sql<{ ok: number }[]>`
      SELECT 1 AS ok FROM entities WHERE grupo = ${input.grupo} AND participa_vr = TRUE LIMIT 1
    `;
    if (!grupoValido) {
      throw new GrupoVrInvalidoError(input.grupo);
    }

    // Só 1 mês aberto por vez — POR GRUPO (cada grupo tem o seu).
    const [mesAberto] = await sql<{ mes: number; ano: number }[]>`
      SELECT mes, ano FROM vr_mes WHERE fechado = FALSE AND grupo = ${input.grupo} LIMIT 1
    `;
    if (mesAberto) {
      throw new VrMesAbertoExistenteError(mesAberto.mes, mesAberto.ano, input.grupo);
    }

    const [existente] = await sql<{ id: string }[]>`
      SELECT id FROM vr_mes
      WHERE mes = ${input.mes} AND ano = ${input.ano} AND grupo = ${input.grupo}
      LIMIT 1
    `;
    if (existente) {
      throw new VrMesJaExisteError(input.mes, input.ano);
    }

    const [criado] = await sql<{ id: string }[]>`
      INSERT INTO vr_mes (grupo, mes, ano, valor_diario, valor_diario_aprendiz)
      VALUES (${input.grupo}, ${input.mes}, ${input.ano}, ${input.valorDiario}, ${input.valorDiarioAprendiz})
      RETURNING id
    `;

    for (const data of input.diasElegiveis) {
      await sql`
        INSERT INTO vr_dia_elegivel (data, vr_mes_id) VALUES (${data}, ${criado.id})
      `;
    }

    return {
      id: criado.id,
      grupo: input.grupo,
      mes: input.mes,
      ano: input.ano,
      fechado: false,
      valorDiario: input.valorDiario,
      valorDiarioAprendiz: input.valorDiarioAprendiz,
      diasElegiveis: input.diasElegiveis.length,
    };
  });
}

/* ── Entidades ─────────────────────────────────────────────────────────── */

/**
 * Lista as entidades que participam do VR (id/nome/grupo), pra dropdowns.
 * `grupo` undefined = todas (só ADMIN); string/null = só daquele grupo.
 */
export async function listarEntidades(grupo?: string | null): Promise<EntidadeOpcao[]> {
  const sql = getDatabase();
  const filtro = grupo === undefined ? sql`` : sql`AND grupo = ${grupo}`;
  return sql<EntidadeOpcao[]>`
    SELECT id, nome, grupo FROM entities WHERE participa_vr = TRUE ${filtro} ORDER BY grupo, nome
  `;
}

/** Grupos que participam do VR (têm ao menos 1 entidade participando). */
export async function listarGruposVr(grupo?: string | null): Promise<string[]> {
  const sql = getDatabase();
  const filtro = grupo === undefined ? sql`` : sql`AND grupo = ${grupo}`;
  const linhas = await sql<{ grupo: string }[]>`
    SELECT DISTINCT grupo FROM entities
    WHERE participa_vr = TRUE AND grupo IS NOT NULL ${filtro}
    ORDER BY grupo
  `;
  return linhas.map((l) => l.grupo);
}

/**
 * Lista o status de fechamento (aberta/fechada) de cada entidade que
 * participa do VR e tem colaborador ativo, dentro de 1 mês específico.
 */
export async function listarStatusFechamentoPorEntidade(
  vrMesId: string,
): Promise<StatusFechamentoEntidade[]> {
  const sql = getDatabase();
  return sql<StatusFechamentoEntidade[]>`
    SELECT DISTINCT
      e.id                          AS "entityId",
      e.nome                        AS "entityNome",
      COALESCE(vfe.fechado, FALSE)  AS fechado,
      vfe.fechado_em                AS "fechadoEm"
    FROM entities e
    JOIN users u ON u.entity_id = e.id AND u.is_active = TRUE AND u.participa_vr = TRUE
    LEFT JOIN vr_fechamento_entidade vfe
      ON vfe.entity_id = e.id AND vfe.vr_mes_id = ${vrMesId}
    WHERE e.participa_vr = TRUE
      AND e.grupo = (SELECT grupo FROM vr_mes WHERE id = ${vrMesId})
    ORDER BY e.nome
  `;
}

/** Entra do id/entity_id do usuário — usado pra checar entidade fechada antes de lançar. */
async function buscarEntidadesDosUsuarios(
  sql: Sql,
  userIds: string[],
): Promise<Map<string, { entityId: string; entityNome: string }>> {
  if (userIds.length === 0) return new Map();
  const linhas = await sql<{ id: string; entityId: string; entityNome: string }[]>`
    SELECT u.id, u.entity_id AS "entityId", e.nome AS "entityNome"
    FROM users u
    JOIN entities e ON e.id = u.entity_id
    WHERE u.id IN ${sql(userIds)}
  `;
  return new Map(linhas.map((l) => [l.id, { entityId: l.entityId, entityNome: l.entityNome }]));
}

/** Entidades (id) já fechadas nesse mês, dentre as informadas. */
async function entidadesJaFechadas(
  sql: Sql,
  vrMesId: string,
  entityIds: string[],
): Promise<Set<string>> {
  if (entityIds.length === 0) return new Set();
  const linhas = await sql<{ entityId: string }[]>`
    SELECT entity_id AS "entityId"
    FROM vr_fechamento_entidade
    WHERE vr_mes_id = ${vrMesId} AND entity_id IN ${sql(entityIds)} AND fechado = TRUE
  `;
  return new Set(linhas.map((l) => l.entityId));
}

/* ── Lançamentos ───────────────────────────────────────────────────────── */

/** Entrada para lançar um desconto/extra manual. */
export interface CriarLancamentoInput {
  userId: string;
  vrMesId: string;
  tipoLancamento: "DESCONTO" | "EXTRA";
  /** Data ISO ("YYYY-MM-DD"). */
  dataDesconto: string;
  motivo: string | null;
}

/** Lançamento de VR (desconto/extra) já com o nome da pessoa resolvido. */
export interface LancamentoVr {
  id: string;
  userId: string;
  userNome: string;
  tipoLancamento: "DESCONTO" | "EXTRA";
  dataDesconto: string;
  motivo: string | null;
  descontoAplicado: boolean;
  /** Nome de quem lançou (null em lançamentos anteriores à coluna criado_por existir). */
  criadoPorNome: string | null;
}

/** Lançado ao tentar cancelar um lançamento que já foi aplicado num fechamento. */
export class LancamentoJaAplicadoError extends Error {
  constructor(id: string) {
    super(`O lançamento ${id} já foi aplicado num fechamento e não pode ser cancelado`);
    this.name = "LancamentoJaAplicadoError";
  }
}

/**
 * Lista os lançamentos (desconto/extra) de um mês, mais recentes primeiro.
 * Passe entityId pra restringir aos colaboradores de 1 entidade.
 */
export async function listarLancamentosDoMes(
  vrMesId: string,
  entityId?: string,
): Promise<LancamentoVr[]> {
  const sql = getDatabase();
  const linhas = entityId
    ? await sql<
        {
          id: string;
          userId: string;
          userNome: string;
          tipoLancamento: "DESCONTO" | "EXTRA";
          dataDesconto: unknown;
          motivo: string | null;
          descontoAplicado: boolean;
          criadoPorNome: string | null;
        }[]
      >`
        SELECT
          l.id, l.user_id AS "userId", u.nome AS "userNome",
          l.tipo_lancamento AS "tipoLancamento", l.data_desconto AS "dataDesconto",
          l.motivo, l.desconto_aplicado AS "descontoAplicado",
          cp.nome AS "criadoPorNome"
        FROM vr_lancamento l
        JOIN users u ON u.id = l.user_id
        LEFT JOIN users cp ON cp.id = l.criado_por
        WHERE l.mes_descontar_valor_id = ${vrMesId} AND u.entity_id = ${entityId}
        ORDER BY l.created_at DESC
      `
    : await sql<
        {
          id: string;
          userId: string;
          userNome: string;
          tipoLancamento: "DESCONTO" | "EXTRA";
          dataDesconto: unknown;
          motivo: string | null;
          descontoAplicado: boolean;
          criadoPorNome: string | null;
        }[]
      >`
        SELECT
          l.id, l.user_id AS "userId", u.nome AS "userNome",
          l.tipo_lancamento AS "tipoLancamento", l.data_desconto AS "dataDesconto",
          l.motivo, l.desconto_aplicado AS "descontoAplicado",
          cp.nome AS "criadoPorNome"
        FROM vr_lancamento l
        JOIN users u ON u.id = l.user_id
        LEFT JOIN users cp ON cp.id = l.criado_por
        WHERE l.mes_descontar_valor_id = ${vrMesId}
        ORDER BY l.created_at DESC
      `;
  return linhas.map((l) => ({
    ...l,
    dataDesconto: new Date(String(l.dataDesconto)).toISOString().slice(0, 10),
  }));
}

/** Cancela (apaga) um lançamento ainda não aplicado. */
export async function cancelarLancamento(id: string): Promise<void> {
  const sql = getDatabase();
  const [existente] = await sql<{ descontoAplicado: boolean }[]>`
    SELECT desconto_aplicado AS "descontoAplicado" FROM vr_lancamento WHERE id = ${id} LIMIT 1
  `;
  if (!existente) return;
  if (existente.descontoAplicado) {
    throw new LancamentoJaAplicadoError(id);
  }
  await sql`DELETE FROM vr_lancamento WHERE id = ${id}`;
}

/**
 * Lista colaboradores ativos só com id/nome (+ entidade) — usado pra popular
 * o seletor de lançamentos. Passe entityId pra restringir a 1 entidade. Sem
 * entityId, já exclui quem é de entidade que não participa do VR (não faz
 * sentido lançar desconto/extra pra quem nunca vai ter fechamento).
 */
export async function listarColaboradoresParaSelecao(
  entityId?: string,
  grupo?: string | null,
): Promise<{ id: string; nome: string; entityId: string; entityGrupo: string | null }[]> {
  const sql = getDatabase();
  const filtroEntidade = entityId ? sql`AND u.entity_id = ${entityId}` : sql``;
  const filtroGrupo = grupo === undefined ? sql`` : sql`AND e.grupo = ${grupo}`;
  return sql<{ id: string; nome: string; entityId: string; entityGrupo: string | null }[]>`
    SELECT u.id, u.nome, u.entity_id AS "entityId", e.grupo AS "entityGrupo"
    FROM users u
    JOIN entities e ON e.id = u.entity_id
    WHERE u.is_active = TRUE AND u.participa_vr = TRUE AND e.participa_vr = TRUE
      ${filtroEntidade} ${filtroGrupo}
    ORDER BY u.nome
  `;
}

/** Lançamento de VR com o mês/ano já resolvidos (visão geral, todos os meses). */
export interface LancamentoVrDetalhado extends LancamentoVr {
  /** Grupo (campo) do mês do lançamento. */
  grupo: string;
  mes: number;
  ano: number;
}

/**
 * Lista TODOS os lançamentos (de todos os meses), mais recentes primeiro —
 * usado pela visão geral ("ver todos os lançamentos").
 */
export async function listarTodosLancamentos(
  grupo?: string | null,
): Promise<LancamentoVrDetalhado[]> {
  const sql = getDatabase();
  const filtroGrupo = grupo === undefined ? sql`` : sql`WHERE m.grupo = ${grupo}`;
  const linhas = await sql<
    {
      id: string;
      userId: string;
      userNome: string;
      tipoLancamento: "DESCONTO" | "EXTRA";
      dataDesconto: unknown;
      motivo: string | null;
      descontoAplicado: boolean;
      criadoPorNome: string | null;
      mes: number;
      ano: number;
      grupo: string;
    }[]
  >`
    SELECT
      l.id, l.user_id AS "userId", u.nome AS "userNome",
      l.tipo_lancamento AS "tipoLancamento", l.data_desconto AS "dataDesconto",
      l.motivo, l.desconto_aplicado AS "descontoAplicado",
      cp.nome AS "criadoPorNome",
      m.mes, m.ano, m.grupo
    FROM vr_lancamento l
    JOIN users u ON u.id = l.user_id
    JOIN vr_mes m ON m.id = l.mes_descontar_valor_id
    LEFT JOIN users cp ON cp.id = l.criado_por
    ${filtroGrupo}
    ORDER BY l.data_desconto DESC
  `;
  return linhas.map((l) => ({
    ...l,
    dataDesconto: new Date(String(l.dataDesconto)).toISOString().slice(0, 10),
  }));
}

/**
 * Lança vários descontos/extras de uma vez (individual multi-data ou em
 * massa). Rejeita o lote inteiro se algum colaborador for de uma entidade
 * que já fechou este mês. Roda numa transação (tudo ou nada).
 *
 * `criadoPorUserId` é quem está autenticado fazendo o lançamento — fica
 * gravado em `vr_lancamento.criado_por` pra mostrar "lançado por" nas telas.
 */
export async function criarLancamentosEmLote(
  vrMesId: string,
  itens: Array<Omit<CriarLancamentoInput, "vrMesId">>,
  criadoPorUserId: string,
): Promise<LancamentoVr[]> {
  const sql = getDatabase();

  return sql.begin(async (sql: postgres.TransactionSql) => {
    const userIds = [...new Set(itens.map((i) => i.userId))];

    // Só dá pra lançar pra quem é de uma entidade do MESMO grupo do mês.
    const [mesDoLote] = await sql<{ grupo: string }[]>`
      SELECT grupo FROM vr_mes WHERE id = ${vrMesId} LIMIT 1
    `;
    if (!mesDoLote) {
      throw new VrMesNaoEncontradoError(vrMesId);
    }
    if (userIds.length > 0) {
      const [fora] = await sql<{ nome: string }[]>`
        SELECT u.nome FROM users u
        LEFT JOIN entities e ON e.id = u.entity_id
        WHERE u.id IN ${sql(userIds)} AND e.grupo IS DISTINCT FROM ${mesDoLote.grupo}
        LIMIT 1
      `;
      if (fora) {
        throw new LancamentoForaDoGrupoError(fora.nome, mesDoLote.grupo);
      }
    }

    const entidadesPorUsuario = await buscarEntidadesDosUsuarios(sql, userIds);
    const entityIdsEnvolvidos = [
      ...new Set([...entidadesPorUsuario.values()].map((e) => e.entityId)),
    ];
    const fechadas = await entidadesJaFechadas(sql, vrMesId, entityIdsEnvolvidos);
    if (fechadas.size > 0) {
      const [entidade] = [...entidadesPorUsuario.values()].filter((e) =>
        fechadas.has(e.entityId),
      );
      throw new EntidadeFechadaNaoAceitaLancamentoError(entidade?.entityNome ?? "Essa entidade");
    }

    const criados: LancamentoVr[] = [];

    for (const item of itens) {
      const [linha] = await sql<
        {
          id: string;
          userId: string;
          userNome: string;
          tipoLancamento: "DESCONTO" | "EXTRA";
          dataDesconto: unknown;
          motivo: string | null;
          descontoAplicado: boolean;
          criadoPorNome: string | null;
        }[]
      >`
        WITH inserido AS (
          INSERT INTO vr_lancamento (user_id, mes_descontar_valor_id, tipo_lancamento, data_desconto, motivo, criado_por)
          VALUES (${item.userId}, ${vrMesId}, ${item.tipoLancamento}, ${item.dataDesconto}, ${item.motivo}, ${criadoPorUserId})
          RETURNING *
        )
        SELECT
          inserido.id, inserido.user_id AS "userId", u.nome AS "userNome",
          inserido.tipo_lancamento AS "tipoLancamento", inserido.data_desconto AS "dataDesconto",
          inserido.motivo, inserido.desconto_aplicado AS "descontoAplicado",
          cp.nome AS "criadoPorNome"
        FROM inserido
        JOIN users u ON u.id = inserido.user_id
        LEFT JOIN users cp ON cp.id = inserido.criado_por
      `;
      criados.push({
        ...linha,
        dataDesconto: new Date(String(linha.dataDesconto)).toISOString().slice(0, 10),
      });
    }

    return criados;
  });
}

/* ── Pré-visualização (dry-run, sem gravar nada) ──────────────────────── */

/** Linha da pré-visualização: o que o fechamento geraria para 1 pessoa. */
export interface PreVisualizacaoLinha {
  userId: string;
  userNome: string;
  userEmail: string;
  diasVr: number;
  qtdDesconto: number;
  qtdExtra: number;
  valorAReceber: number;
}

/** Totais agregados da pré-visualização (cards de resumo). */
export interface PreVisualizacaoResultado {
  itens: PreVisualizacaoLinha[];
  totalBruto: number;
  totalDescontos: number;
  totalExtras: number;
  valorFinal: number;
  colaboradores: number;
}

/**
 * Simula o que o fechamento geraria — MESMO CÁLCULO do fechamento de
 * verdade (FIFO, capacidade = dias-base + extras), mas sem gravar nada no
 * banco. Passe entityId pra restringir a 1 entidade.
 */
export async function preVisualizarFechamento(
  vrMesId: string,
  entityId?: string,
): Promise<PreVisualizacaoResultado> {
  const sql = getDatabase();

  const [vrMes] = await sql<{ grupo: string; valorDiario: number; valorDiarioAprendiz: number }[]>`
    SELECT grupo, valor_diario::float8 AS "valorDiario", valor_diario_aprendiz::float8 AS "valorDiarioAprendiz"
    FROM vr_mes WHERE id = ${vrMesId} LIMIT 1
  `;
  if (!vrMes) {
    throw new VrMesNaoEncontradoError(vrMesId);
  }

  const diasBase = await contarDiasBase(sql, vrMesId);
  const usuarios = await listarUsuariosElegiveis(sql, entityId, vrMes.grupo);

  const itens: PreVisualizacaoLinha[] = [];
  let totalBruto = 0;
  let totalDescontos = 0;
  let totalExtras = 0;

  for (const usuario of usuarios) {
    const pendentes = await listarLancamentosPendentes(sql, vrMesId, usuario.id);

    const extras = pendentes.filter((l) => l.tipoLancamento === "EXTRA");
    const descontos = pendentes.filter((l) => l.tipoLancamento === "DESCONTO");

    const qtdExtra = extras.length;
    const capacidade = diasBase + qtdExtra;
    const qtdDesconto = Math.min(descontos.length, capacidade);

    const diasVr = Math.max(0, diasBase + qtdExtra - qtdDesconto);
    const valorUnitario = usuario.isAprendiz ? vrMes.valorDiarioAprendiz : vrMes.valorDiario;
    const valorAReceber = diasVr * valorUnitario;

    itens.push({
      userId: usuario.id,
      userNome: usuario.nome,
      userEmail: usuario.email,
      diasVr,
      qtdDesconto,
      qtdExtra,
      valorAReceber,
    });

    totalBruto += diasBase * valorUnitario;
    totalDescontos += qtdDesconto * valorUnitario;
    totalExtras += qtdExtra * valorUnitario;
  }

  const valorFinal = itens.reduce((soma, i) => soma + i.valorAReceber, 0);

  return { itens, totalBruto, totalDescontos, totalExtras, valorFinal, colaboradores: itens.length };
}

/* ── Fechamento (por entidade) ────────────────────────────────────────── */

/**
 * Fecha o VR de UMA entidade dentro de um mês: aplica os lançamentos
 * pendentes (FIFO) só de quem é dessa entidade, e grava o vr_registro de
 * cada um. Roda numa transação — se algo falhar no meio, nada é persistido.
 *
 * Se essa for a última entidade pendente (todas as outras já fecharam), o
 * vr_mes inteiro também é marcado como fechado (bloqueia edição do
 * calendário/valores).
 *
 * Idempotente por pessoa: se rodado de novo pra uma entidade AINDA aberta,
 * atualiza os vr_registro em vez de duplicar. Mas não pode rodar 2x pra uma
 * entidade já fechada (EntidadeJaFechadaError).
 */
export async function fecharVrPorEntidade(
  vrMesId: string,
  entityId: string,
): Promise<FechamentoVrResultado> {
  const sql = getDatabase();

  return sql.begin(async (sql: postgres.TransactionSql) => {
    const vrMes = await buscarVrMesParaFechamento(sql, vrMesId);
    if (!vrMes) {
      throw new VrMesNaoEncontradoError(vrMesId);
    }

    const [entidade] = await sql<{ nome: string; participaVr: boolean; grupo: string | null }[]>`
      SELECT nome, participa_vr AS "participaVr", grupo FROM entities WHERE id = ${entityId} LIMIT 1
    `;
    if (!entidade) {
      throw new VrMesNaoEncontradoError(entityId);
    }
    if (!entidade.participaVr) {
      throw new EntidadeNaoParticipaVrError(entidade.nome);
    }
    if (entidade.grupo !== vrMes.grupo) {
      throw new EntidadeForaDoGrupoError(entidade.nome, vrMes.grupo);
    }

    // Garante a linha de controle e trava ela (evita 2 fechamentos concorrentes da mesma entidade).
    await sql`
      INSERT INTO vr_fechamento_entidade (vr_mes_id, entity_id)
      VALUES (${vrMesId}, ${entityId})
      ON CONFLICT (vr_mes_id, entity_id) DO NOTHING
    `;
    const [controle] = await sql<{ fechado: boolean }[]>`
      SELECT fechado FROM vr_fechamento_entidade
      WHERE vr_mes_id = ${vrMesId} AND entity_id = ${entityId}
      FOR UPDATE
    `;
    if (controle.fechado) {
      throw new EntidadeJaFechadaError(entidade.nome);
    }

    const diasBase = await contarDiasBase(sql, vrMesId);
    const usuarios = await listarUsuariosElegiveis(sql, entityId, vrMes.grupo);

    let proximoMes: { id: string } | null = null;
    const garantirProximo = async () => {
      if (!proximoMes) {
        proximoMes = await garantirProximoVrMes(
          sql,
          vrMes.mes,
          vrMes.ano,
          vrMes.grupo,
          vrMes.valorDiario,
          vrMes.valorDiarioAprendiz,
        );
      }
      return proximoMes;
    };

    let registrosGerados = 0;
    let lancamentosAplicados = 0;
    let lancamentosPendentesProximoMes = 0;

    for (const usuario of usuarios) {
      const pendentes = await listarLancamentosPendentes(sql, vrMesId, usuario.id);

      const extras = pendentes.filter((l) => l.tipoLancamento === "EXTRA");
      const descontos = pendentes.filter((l) => l.tipoLancamento === "DESCONTO");

      const qtdExtra = extras.length;
      const capacidade = diasBase + qtdExtra;
      const descontosAplicar = descontos.slice(0, capacidade);
      const descontosExcedentes = descontos.slice(capacidade);

      const qtdDesconto = descontosAplicar.length;
      const diasVr = Math.max(0, diasBase + qtdExtra - qtdDesconto);
      const valorUnitario = usuario.isAprendiz ? vrMes.valorDiarioAprendiz : vrMes.valorDiario;
      const valorAReceber = diasVr * valorUnitario;

      const idsAplicados = [...extras, ...descontosAplicar].map((l) => l.id);
      if (idsAplicados.length > 0) {
        await sql`
          UPDATE vr_lancamento
          SET desconto_aplicado = TRUE, data_aplicacao = NOW()
          WHERE id IN ${sql(idsAplicados)}
        `;
        lancamentosAplicados += idsAplicados.length;
      }

      if (descontosExcedentes.length > 0) {
        const proximo = await garantirProximo();
        const idsExcedentes = descontosExcedentes.map((l) => l.id);
        await sql`
          UPDATE vr_lancamento
          SET mes_descontar_valor_id = ${proximo.id}
          WHERE id IN ${sql(idsExcedentes)}
        `;
        lancamentosPendentesProximoMes += idsExcedentes.length;
      }

      await sql`
        INSERT INTO vr_registro (
          user_id, vr_mes_id, qtd_desconto, qtd_extra, dias_vr, valor_a_receber, fechado_em
        )
        VALUES (
          ${usuario.id}, ${vrMesId}, ${qtdDesconto}, ${qtdExtra}, ${diasVr}, ${valorAReceber}, NOW()
        )
        ON CONFLICT (user_id, vr_mes_id) DO UPDATE SET
          qtd_desconto    = EXCLUDED.qtd_desconto,
          qtd_extra       = EXCLUDED.qtd_extra,
          dias_vr         = EXCLUDED.dias_vr,
          valor_a_receber = EXCLUDED.valor_a_receber,
          fechado_em      = EXCLUDED.fechado_em,
          updated_at      = NOW()
      `;
      registrosGerados += 1;
    }

    await sql`
      UPDATE vr_fechamento_entidade
      SET fechado = TRUE, fechado_em = NOW(), updated_at = NOW()
      WHERE vr_mes_id = ${vrMesId} AND entity_id = ${entityId}
    `;

    // Se todas as entidades que PARTICIPAM DO VR (com colaborador ativo que
    // também participa) já fecharam, marca o mês inteiro como fechado (só
    // afeta a edição do calendário/valores) — entidades com participa_vr =
    // FALSE, e pessoas com participa_vr = FALSE, nunca entram nessa
    // contagem, então nunca travam o mês esperando por elas.
    const [{ totalEntidades }] = await sql<{ totalEntidades: number }[]>`
      SELECT COUNT(DISTINCT u.entity_id)::int AS "totalEntidades"
      FROM users u
      JOIN entities e ON e.id = u.entity_id
      WHERE u.is_active = TRUE AND u.participa_vr = TRUE AND e.participa_vr = TRUE
        AND e.grupo = ${vrMes.grupo}
    `;
    const [{ totalFechadas }] = await sql<{ totalFechadas: number }[]>`
      SELECT COUNT(*)::int AS "totalFechadas"
      FROM vr_fechamento_entidade WHERE vr_mes_id = ${vrMesId} AND fechado = TRUE
    `;
    const mesInteiroFechado = totalFechadas >= totalEntidades;
    if (mesInteiroFechado) {
      await sql`UPDATE vr_mes SET fechado = TRUE, updated_at = NOW() WHERE id = ${vrMesId}`;
    }

    return {
      vrMesId,
      entityId,
      entityNome: entidade.nome,
      registrosGerados,
      lancamentosAplicados,
      lancamentosPendentesProximoMes,
      mesInteiroFechado,
    };
  });
}

/* ── Edição de mês (só enquanto nenhuma entidade fechou) ──────────────── */

/** Detalhe completo de um mês, incluindo as datas dos dias elegíveis (pra edição). */
export interface VrMesDetalhado extends VrMesResumo {
  diasElegiveisDatas: string[];
}

/** Entrada para editar um mês já cadastrado. */
export interface EditarVrMesInput {
  valorDiario: number;
  valorDiarioAprendiz: number;
  /** Lista completa dos dias elegíveis (substitui a anterior por inteiro). */
  diasElegiveis: string[];
}

/**
 * Busca um mês com o detalhe completo (incluindo as datas dos dias elegíveis,
 * uma a uma) — usado pra pré-popular o formulário de edição.
 */
export async function buscarVrMesDetalhado(vrMesId: string): Promise<VrMesDetalhado | null> {
  const sql = getDatabase();

  const [vrMes] = await sql<{
    id: string;
    grupo: string;
    mes: number;
    ano: number;
    fechado: boolean;
    valorDiario: number;
    valorDiarioAprendiz: number;
  }[]>`
    SELECT id, grupo, mes, ano, fechado,
           valor_diario::float8          AS "valorDiario",
           valor_diario_aprendiz::float8 AS "valorDiarioAprendiz"
    FROM vr_mes
    WHERE id = ${vrMesId}
    LIMIT 1
  `;
  if (!vrMes) return null;

  const dias = await sql<{ data: unknown }[]>`
    SELECT data FROM vr_dia_elegivel WHERE vr_mes_id = ${vrMesId} ORDER BY data
  `;
  const diasElegiveisDatas = dias.map((d) => new Date(String(d.data)).toISOString().slice(0, 10));

  return { ...vrMes, diasElegiveis: diasElegiveisDatas.length, diasElegiveisDatas };
}

/**
 * Edita um mês já cadastrado: valores diários + substitui por completo o
 * calendário de dias elegíveis. Só permitido enquanto NENHUMA entidade
 * tiver fechado esse mês ainda (mudar os dias invalidaria o cálculo já
 * feito). Roda numa transação (tudo ou nada).
 */
export async function editarVrMes(vrMesId: string, input: EditarVrMesInput): Promise<VrMesResumo> {
  if (input.diasElegiveis.length === 0) {
    throw new VrMesSemDiasElegiveisError();
  }

  const sql = getDatabase();

  return sql.begin(async (sql: postgres.TransactionSql) => {
    const [vrMes] = await sql<{ id: string }[]>`
      SELECT id FROM vr_mes WHERE id = ${vrMesId} FOR UPDATE
    `;
    if (!vrMes) {
      throw new VrMesNaoEncontradoError(vrMesId);
    }

    const [{ existeEntidadeFechada }] = await sql<{ existeEntidadeFechada: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM vr_fechamento_entidade WHERE vr_mes_id = ${vrMesId} AND fechado = TRUE
      ) AS "existeEntidadeFechada"
    `;
    if (existeEntidadeFechada) {
      throw new VrMesJaFechadoError(vrMesId);
    }

    await sql`
      UPDATE vr_mes
      SET valor_diario = ${input.valorDiario},
          valor_diario_aprendiz = ${input.valorDiarioAprendiz},
          updated_at = NOW()
      WHERE id = ${vrMesId}
    `;

    await sql`DELETE FROM vr_dia_elegivel WHERE vr_mes_id = ${vrMesId}`;
    for (const data of input.diasElegiveis) {
      await sql`INSERT INTO vr_dia_elegivel (data, vr_mes_id) VALUES (${data}, ${vrMesId})`;
    }

    const [atualizado] = await sql<{ grupo: string; mes: number; ano: number }[]>`
      SELECT grupo, mes, ano FROM vr_mes WHERE id = ${vrMesId}
    `;

    return {
      id: vrMesId,
      mes: atualizado.mes,
      grupo: atualizado.grupo,
      ano: atualizado.ano,
      fechado: false,
      valorDiario: input.valorDiario,
      valorDiarioAprendiz: input.valorDiarioAprendiz,
      diasElegiveis: input.diasElegiveis.length,
    };
  });
}

/* ── Escopo por grupo (campo) ──────────────────────────────────────────── */

/**
 * O que a pessoa logada pode enxergar no VR: ADMIN vê todos os grupos; os
 * demais só o grupo da PRÓPRIA entidade (users.entity_id → entities.grupo).
 */
export interface EscopoVr {
  admin: boolean;
  grupo: string | null;
}

/** Lançado quando a pessoa tenta mexer num mês de outro grupo. A rota converte isso num 403. */
export class AcessoMesVrNegadoError extends Error {
  constructor() {
    super("Esse mês pertence a outro grupo — você só pode mexer no VR do seu grupo");
    this.name = "AcessoMesVrNegadoError";
  }
}

/** Lançado quando o usuário não tem entidade/grupo vinculado. A rota converte isso num 403. */
export class SemGrupoVrError extends Error {
  constructor() {
    super("Seu usuário não está vinculado a uma entidade/grupo — peça pro RH ajustar o cadastro");
    this.name = "SemGrupoVrError";
  }
}

/** Lançado ao fechar uma entidade que não é do grupo do mês. A rota converte isso num 400. */
export class EntidadeForaDoGrupoError extends Error {
  constructor(entityNome: string, grupo: string) {
    super(`${entityNome} não pertence ao grupo ${grupo} deste mês`);
    this.name = "EntidadeForaDoGrupoError";
  }
}

/** Lançado ao lançar desconto/extra pra alguém de outro grupo. A rota converte isso num 400. */
export class LancamentoForaDoGrupoError extends Error {
  constructor(userNome: string, grupo: string) {
    super(`${userNome} não pertence ao grupo ${grupo} deste mês`);
    this.name = "LancamentoForaDoGrupoError";
  }
}

/** Lançado ao cadastrar um mês pra um grupo que não existe/não participa do VR. A rota converte isso num 400. */
export class GrupoVrInvalidoError extends Error {
  constructor(grupo: string) {
    super(`O grupo ${grupo} não existe ou não participa do Vale-Refeição`);
    this.name = "GrupoVrInvalidoError";
  }
}

/** Resolve o escopo da pessoa logada (ADMIN = tudo; senão, o grupo da própria entidade). */
export async function resolverEscopoVr(user: {
  id: string;
  papelCodigo?: string | null;
}): Promise<EscopoVr> {
  if (user.papelCodigo === "ADMIN") return { admin: true, grupo: null };
  const sql = getDatabase();
  const [linha] = await sql<{ grupo: string | null }[]>`
    SELECT e.grupo FROM users u
    JOIN entities e ON e.id = u.entity_id
    WHERE u.id = ${user.id}
    LIMIT 1
  `;
  return { admin: false, grupo: linha?.grupo ?? null };
}

/** Valor do filtro de grupo nas listagens: undefined = sem filtro (ADMIN); senão filtra pelo grupo (null = nada). */
export function grupoDoEscopo(escopo: EscopoVr): string | null | undefined {
  return escopo.admin ? undefined : escopo.grupo;
}

/** Garante que a pessoa pode mexer nesse mês (do grupo dela, ou ADMIN). Devolve o grupo do mês. */
export async function garantirAcessoAoMes(vrMesId: string, escopo: EscopoVr): Promise<string> {
  const sql = getDatabase();
  const [mes] = await sql<{ grupo: string }[]>`
    SELECT grupo FROM vr_mes WHERE id = ${vrMesId} LIMIT 1
  `;
  if (!mes) throw new VrMesNaoEncontradoError(vrMesId);
  if (!escopo.admin && !escopo.grupo) throw new SemGrupoVrError();
  if (!escopo.admin && mes.grupo !== escopo.grupo) throw new AcessoMesVrNegadoError();
  return mes.grupo;
}

/** Garante que a pessoa pode cancelar esse lançamento (o mês dele é do grupo dela, ou ADMIN). */
export async function garantirAcessoAoLancamento(id: string, escopo: EscopoVr): Promise<void> {
  const sql = getDatabase();
  const [linha] = await sql<{ grupo: string }[]>`
    SELECT m.grupo FROM vr_lancamento l
    JOIN vr_mes m ON m.id = l.mes_descontar_valor_id
    WHERE l.id = ${id}
    LIMIT 1
  `;
  if (!linha) return; // nada a cancelar — cancelarLancamento já trata como no-op
  if (!escopo.admin && linha.grupo !== escopo.grupo) throw new AcessoMesVrNegadoError();
}