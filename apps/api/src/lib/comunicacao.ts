import { getDatabase } from "./database.js";
import type {
  Comunicado,
  ComunicadoPublicacao,
  CriarComunicadoInput,
} from "../types/comunicacao.js";
import {
  podeCriarComunicado,
  podeAprovarOuRejeitar,
  podeRemover,
  statusInicial,
  validarPeriodo,
  validarRecorrencia,
} from "./comunicacao.regras.js";

/** Final do dia (23:59:59.999 UTC) de uma data "YYYY-MM-DD" — pra a publicação
 * ficar no ar até o fim da data_fim, não expirar já na meia-noite dela. */
function fimDoDia(dataIso: string): Date {
  const data = new Date(dataIso);
  data.setUTCHours(23, 59, 59, 999);
  return data;
}

function mapComunicado(row: any): Comunicado {
  return {
    id: row.id,
    titulo: row.titulo,
    descricao: row.descricao,
    criadoPor: row.criado_por,
    criadoEm: row.criado_em,
    status: row.status,
    aprovadoPor: row.aprovado_por,
    aprovadoEm: row.aprovado_em,
    motivoRejeicao: row.motivo_rejeicao,
    removidoPor: row.removido_por,
    removidoEm: row.removido_em,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    recorrente: row.recorrente,
    diaSemana: row.dia_semana,
    anexoUrl: row.anexo_url,
    anexoTipo: row.anexo_tipo,
    updatedAt: row.updated_at,
  };
}

function mapPublicacao(row: any): ComunicadoPublicacao {
  return {
    id: row.id,
    comunicadoId: row.comunicado_id,
    publicadoEm: row.publicado_em,
    expiraEm: row.expira_em,
    encerradoManualmente: row.encerrado_manualmente,
    encerradoPor: row.encerrado_por,
    encerradoEm: row.encerrado_em,
    createdAt: row.created_at,
  };
}

async function criarPublicacao(comunicadoId: number, expiraEm: Date): Promise<ComunicadoPublicacao> {
  const sql = getDatabase();
  const [row] = await sql`
    INSERT INTO comunicado_publicacoes (comunicado_id, expira_em)
    VALUES (${comunicadoId}, ${expiraEm})
    RETURNING *
  `;
  return mapPublicacao(row);
}

export async function criarComunicado(
  input: CriarComunicadoInput,
  criadoPor: string,
  papelCodigo: string
): Promise<Comunicado> {
  if (!podeCriarComunicado(papelCodigo)) {
    throw new Error("Colaborador não pode criar comunicados");
  }

  const recorrente = !!input.recorrente;
  validarPeriodo(recorrente, input.dataInicio, input.dataFim);
  validarRecorrencia(recorrente, input.diaSemana);

  const status = statusInicial(papelCodigo);

  const sql = getDatabase();
  const [row] = await sql`
    INSERT INTO comunicados (
      titulo, descricao, criado_por, status,
      data_inicio, data_fim, recorrente, dia_semana,
      anexo_url, anexo_tipo
    ) VALUES (
      ${input.titulo}, ${input.descricao}, ${criadoPor}, ${status},
      ${recorrente ? null : input.dataInicio ?? null},
      ${recorrente ? null : input.dataFim ?? null},
      ${recorrente}, ${input.diaSemana ?? null},
      ${input.anexoUrl ?? null}, ${input.anexoTipo ?? null}
    )
    RETURNING *
  `;

  const comunicado = mapComunicado(row);

  // Recorrente não precisa de "publicação" — a visibilidade é calculada na
  // hora (bate o dia_semana com hoje?). Só o não-recorrente usa esse rastro.
  if (comunicado.status === "PUBLICADO" && !comunicado.recorrente) {
    await criarPublicacao(comunicado.id, fimDoDia(comunicado.dataFim!));
  }

  return comunicado;
}

export async function aprovarComunicado(
  comunicadoId: number,
  aprovadoPor: string,
  papelCodigo: string
): Promise<Comunicado> {
  if (!podeAprovarOuRejeitar(papelCodigo)) {
    throw new Error("Apenas o RH pode aprovar comunicados");
  }

  const sql = getDatabase();
  const [row] = await sql`
    UPDATE comunicados
    SET status = 'PUBLICADO', aprovado_por = ${aprovadoPor}, aprovado_em = now(), updated_at = now()
    WHERE id = ${comunicadoId} AND status = 'AGUARDANDO_APROVACAO'
    RETURNING *
  `;

  if (!row) {
    throw new Error("Comunicado não encontrado ou não está aguardando aprovação");
  }

  const comunicado = mapComunicado(row);
  if (!comunicado.recorrente) {
    await criarPublicacao(comunicado.id, fimDoDia(comunicado.dataFim!));
  }

  return comunicado;
}

export async function rejeitarComunicado(
  comunicadoId: number,
  motivoRejeicao: string,
  aprovadoPor: string,
  papelCodigo: string
): Promise<Comunicado> {
  if (!podeAprovarOuRejeitar(papelCodigo)) {
    throw new Error("Apenas o RH pode rejeitar comunicados");
  }

  const sql = getDatabase();
  const [row] = await sql`
    UPDATE comunicados
    SET status = 'REJEITADO', motivo_rejeicao = ${motivoRejeicao},
        aprovado_por = ${aprovadoPor}, aprovado_em = now(), updated_at = now()
    WHERE id = ${comunicadoId} AND status = 'AGUARDANDO_APROVACAO'
    RETURNING *
  `;

  if (!row) {
    throw new Error("Comunicado não encontrado ou não está aguardando aprovação");
  }

  return mapComunicado(row);
}

export async function removerComunicado(
  comunicadoId: number,
  removidoPor: string,
  papelCodigo: string
): Promise<Comunicado> {
  if (!podeRemover(papelCodigo)) {
    throw new Error("Apenas o RH pode remover comunicados do ar");
  }

  const sql = getDatabase();
  const [row] = await sql`
    UPDATE comunicados
    SET status = 'REMOVIDO', removido_por = ${removidoPor}, removido_em = now(), updated_at = now()
    WHERE id = ${comunicadoId} AND status = 'PUBLICADO'
    RETURNING *
  `;

  if (!row) {
    throw new Error("Comunicado não encontrado ou não está publicado");
  }

  await sql`
    UPDATE comunicado_publicacoes
    SET encerrado_manualmente = true, encerrado_por = ${removidoPor}, encerrado_em = now()
    WHERE comunicado_id = ${comunicadoId} AND expira_em > now() AND encerrado_manualmente = false
  `;

  return mapComunicado(row);
}

export async function buscarComunicadoPorId(comunicadoId: number): Promise<Comunicado | undefined> {
  const sql = getDatabase();
  const [row] = await sql`SELECT * FROM comunicados WHERE id = ${comunicadoId}`;
  return row ? mapComunicado(row) : undefined;
}

// Anexa (ou troca) o arquivo de um comunicado. Só o próprio criador ou o RH.
export async function anexarArquivoComunicado(
  comunicadoId: number,
  usuarioId: string,
  papelCodigo: string,
  key: string,
  anexoTipo: "IMAGEM" | "PDF"
): Promise<Comunicado> {
  const comunicado = await buscarComunicadoPorId(comunicadoId);
  if (!comunicado) {
    throw new Error("Comunicado não encontrado");
  }
  if (comunicado.criadoPor !== usuarioId && !podeAprovarOuRejeitar(papelCodigo)) {
    throw new Error("Você não pode anexar arquivo neste comunicado");
  }

  const sql = getDatabase();
  const [row] = await sql`
    UPDATE comunicados
    SET anexo_url = ${key}, anexo_tipo = ${anexoTipo}, updated_at = now()
    WHERE id = ${comunicadoId}
    RETURNING *
  `;
  return mapComunicado(row);
}

// Fila de aprovação do RH: comunicados aguardando decisão, mais antigos primeiro.
export async function listarComunicadosPendentes(): Promise<Comunicado[]> {
  const sql = getDatabase();
  const rows = await sql`
    SELECT * FROM comunicados
    WHERE status = 'AGUARDANDO_APROVACAO'
    ORDER BY criado_em ASC
  `;
  return rows.map(mapComunicado);
}

// Mural: não-recorrente cuja data_inicio já chegou e data_fim ainda não
// passou, OU recorrente cujo dia_semana bate com hoje. Vários podem estar
// ativos ao mesmo tempo — não há regra de exclusividade.
export async function listarComunicadosAtivos(): Promise<Comunicado[]> {
  const sql = getDatabase();
  const rows = await sql`
    SELECT c.*
    FROM comunicados c
    WHERE c.status = 'PUBLICADO'
      AND (
        (
          c.recorrente = false
          AND c.data_inicio <= CURRENT_DATE
          AND c.data_fim >= CURRENT_DATE
        )
        OR
        (
          c.recorrente = true
          AND c.dia_semana = EXTRACT(DOW FROM CURRENT_DATE)::int
        )
      )
    ORDER BY c.criado_em DESC
  `;
  return rows.map(mapComunicado);
}

// Agendados: não-recorrente já aprovado/publicado, mas cuja data_inicio
// ainda não chegou — só o RH/ADMIN vê essa lista, pra acompanhar ou cancelar
// antes de entrar no ar.
export async function listarComunicadosAgendados(): Promise<Comunicado[]> {
  const sql = getDatabase();
  const rows = await sql`
    SELECT * FROM comunicados
    WHERE status = 'PUBLICADO' AND recorrente = false AND data_inicio > CURRENT_DATE
    ORDER BY data_inicio ASC
  `;
  return rows.map(mapComunicado);
}

// Job de expiração: encerra comunicados não-recorrentes cuja data_fim já passou.
// Recorrentes não têm data_fim — ficam no ar indefinidamente até serem
// removidos manualmente pelo RH/ADMIN.
export async function encerrarVencidos(): Promise<number> {
  const sql = getDatabase();
  const rows = await sql`
    UPDATE comunicados
    SET status = 'ENCERRADO', updated_at = now()
    WHERE status = 'PUBLICADO' AND recorrente = false AND data_fim < CURRENT_DATE
    RETURNING id
  `;
  return rows.length;
}