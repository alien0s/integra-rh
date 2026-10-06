import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

import { getDatabase } from "./database.js";

/**
 * Módulo de Vale-Refeição (VR) — geração dos 3 arquivos de fechamento:
 * relatório em PDF, arquivo CSV para a operadora e planilha Excel.
 *
 * Todos recebem o vrMesId já fechado e devolvem um Buffer pronto para a
 * rota devolver como download (Content-Disposition: attachment).
 */

/** Código fixo de consumo do sistema, usado em todas as linhas do CSV. */
const CODIGO_CONSUMO_SISTEMA = "95013";

/* ── Busca dos dados (comum aos 3 formatos) ───────────────────────────── */

/** Linha com todos os dados necessários para os 3 formatos de exportação. */
export interface VrRegistroExport {
  nome: string;
  email: string;
  cpf: string | null;
  dataNascimento: Date | null;
  /** 1 = masculino, 0 = feminino (mesma convenção de users.sexo) */
  sexo: number | null;
  entidadeNome: string | null;
  entidadeGrupo: string | null;
  /** Código APS da pessoa, escopado por entidade (users.codigo_aps). */
  codigoAps: number | null;
  diasVr: number;
  qtdDesconto: number;
  valorAReceber: number;
}

interface LinhaExportacaoRaw {
  nome: string;
  email: string;
  cpf: string | null;
  dataNascimento: unknown;
  sexo: number | null;
  entidadeNome: string | null;
  entidadeGrupo: string | null;
  codigoAps: number | null;
  diasVr: number;
  qtdDesconto: number;
  valorAReceber: string; // numeric vem como string do postgres.js
}

/**
 * Busca os registros de VR de um mês já fechado, com os dados de pessoa e
 * entidade resolvidos via JOIN, prontos para os 3 formatos de exportação.
 */
/**
 * Busca os registros de VR de um mês (já fechado, no todo ou por entidade),
 * com os dados de pessoa e entidade resolvidos via JOIN, prontos para os 3
 * formatos de exportação. Passe entityId pra restringir a 1 entidade.
 */
export async function buscarRegistrosParaExportacao(
  vrMesId: string,
  entityId?: string,
): Promise<VrRegistroExport[]> {
  const sql = getDatabase();

  const linhas = entityId
    ? await sql<LinhaExportacaoRaw[]>`
        SELECT
          u.nome,
          u.email,
          u.cpf,
          u.data_nascimento AS "dataNascimento",
          u.sexo,
          e.nome            AS "entidadeNome",
          e.grupo           AS "entidadeGrupo",
          u.codigo_aps      AS "codigoAps",
          r.dias_vr         AS "diasVr",
          r.qtd_desconto    AS "qtdDesconto",
          r.valor_a_receber::float8 AS "valorAReceber"
        FROM vr_registro r
        JOIN users u    ON u.id = r.user_id
        LEFT JOIN entities e ON e.id = u.entity_id
        WHERE r.vr_mes_id = ${vrMesId} AND u.entity_id = ${entityId}
        ORDER BY u.nome
      `
    : await sql<LinhaExportacaoRaw[]>`
        SELECT
          u.nome,
          u.email,
          u.cpf,
          u.data_nascimento AS "dataNascimento",
          u.sexo,
          e.nome            AS "entidadeNome",
          e.grupo           AS "entidadeGrupo",
          u.codigo_aps      AS "codigoAps",
          r.dias_vr         AS "diasVr",
          r.qtd_desconto    AS "qtdDesconto",
          r.valor_a_receber::float8 AS "valorAReceber"
        FROM vr_registro r
        JOIN users u    ON u.id = r.user_id
        LEFT JOIN entities e ON e.id = u.entity_id
        WHERE r.vr_mes_id = ${vrMesId}
        ORDER BY u.nome
      `;

  return linhas.map((l) => ({
    nome: l.nome,
    email: l.email,
    cpf: l.cpf,
    dataNascimento: l.dataNascimento ? new Date(String(l.dataNascimento)) : null,
    sexo: l.sexo,
    entidadeNome: l.entidadeNome,
    entidadeGrupo: l.entidadeGrupo,
    codigoAps: l.codigoAps,
    diasVr: l.diasVr,
    qtdDesconto: l.qtdDesconto,
    valorAReceber: Number(l.valorAReceber),
  }));
}

/* ── Formatação comum ──────────────────────────────────────────────────── */

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarDataBr(data: Date | null): string {
  if (!data) return "";
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${data.getUTCFullYear()}`;
}

/* ── 1. PDF (relatório visual) ─────────────────────────────────────────── */

/**
 * Gera o relatório em PDF: Nome, E-mail, Dias VR/Descontos, Valor a
 * Descontar, Valor a Receber.
 *
 * OBS: "Valor a Descontar" não tem uma regra de cálculo própria no modelo de
 * dados atual (vr_registro guarda só qtd_desconto EM DIAS, não um valor
 * monetário à parte) — no exemplo original do documento, essa coluna
 * aparecia sempre como R$ 0 para todo mundo. Mantive como 0 aqui; se existir
 * uma regra de negócio para essa coluna (ex.: desconto em dinheiro separado
 * dos dias), me avisa que eu ajusto o cálculo.
 */
export async function gerarRelatorioVrPdf(
  registros: VrRegistroExport[],
  extraidoPor: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("Relatório VR", { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#555555")
      .text(`PDF Extraído Por: ${extraidoPor}    ${new Date().toLocaleString("pt-BR")}`);
    doc.moveDown(1);
    doc.fillColor("#000000");

    const colunas = [
      { chave: "nome", titulo: "Nome", largura: 200 },
      { chave: "email", titulo: "E-mail", largura: 220 },
      { chave: "diasDescontos", titulo: "Dias VR /Descontos", largura: 130 },
      { chave: "valorDescontar", titulo: "Valor a Descontar", largura: 110 },
      { chave: "valorReceber", titulo: "Valor a Receber", largura: 110 },
    ] as const;

    const inicioX = doc.page.margins.left;
    let y = doc.y;

    function desenharCabecalho() {
      let x = inicioX;
      doc.font("Helvetica-Bold").fontSize(10);
      for (const col of colunas) {
        doc.text(col.titulo, x, y, { width: col.largura });
        x += col.largura;
      }
      y += 18;
      doc
        .moveTo(inicioX, y)
        .lineTo(inicioX + colunas.reduce((s, c) => s + c.largura, 0), y)
        .strokeColor("#dddddd")
        .stroke();
      y += 6;
    }

    desenharCabecalho();
    doc.font("Helvetica").fontSize(9);

    for (const registro of registros) {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 30 });
        y = doc.page.margins.top;
        desenharCabecalho();
        doc.font("Helvetica").fontSize(9);
      }

      let x = inicioX;
      doc.fillColor("#000000").text(registro.nome, x, y, { width: colunas[0].largura });
      x += colunas[0].largura;
      doc.text(registro.email, x, y, { width: colunas[1].largura });
      x += colunas[1].largura;
      doc.text(`${registro.diasVr}/${registro.qtdDesconto}`, x, y, {
        width: colunas[2].largura,
      });
      x += colunas[2].largura;
      doc.fillColor("#c0392b").text(formatarMoeda(0), x, y, { width: colunas[3].largura });
      x += colunas[3].largura;
      doc
        .fillColor("#27ae60")
        .text(formatarMoeda(registro.valorAReceber), x, y, { width: colunas[4].largura });

      y += 20;
    }

    doc.end();
  });
}

/* ── 2. CSV (arquivo para a operadora) ────────────────────────────────── */

/**
 * Gera o CSV no formato esperado pela operadora:
 * `codigo_aps;95013;valor` — separador ";", um por linha, sem cabeçalho
 * (confirmado com o exemplo do documento original).
 *
 * Pessoas sem codigo_aps preenchido são PULADAS (não têm como ser
 * identificadas pela operadora) — se isso não for aceitável, me avisa que eu
 * mudo para bloquear a exportação inteira nesse caso, em vez de só pular.
 */
export function gerarRelatorioVrCsv(registros: VrRegistroExport[]): string {
  const linhas = registros
    .filter((r) => r.codigoAps !== null)
    .map((r) => `${r.codigoAps};${CODIGO_CONSUMO_SISTEMA};${r.valorAReceber}`);
  return linhas.join("\n");
}

/* ── 3. Excel (planilha para conferência/backup) ──────────────────────── */

/**
 * Gera a planilha Excel: Nome, DataNascimento, Cpf, Entidade, Sexo, ValorVR, Tipo.
 * "Entidade" = "<nome> - <grupo>" (ex.: "RADOAM - ACeAm").
 * "Sexo" = "M"/"F" (users.sexo: 1 = masculino, 0 = feminino).
 * "Tipo" = sempre "VR".
 */
export function gerarRelatorioVrExcel(registros: VrRegistroExport[]): Buffer {
  const linhas = registros.map((r) => ({
    Nome: r.nome,
    DataNascimento: formatarDataBr(r.dataNascimento),
    Cpf: r.cpf ?? "",
    Entidade:
      r.entidadeNome && r.entidadeGrupo
        ? `${r.entidadeNome} - ${r.entidadeGrupo}`
        : (r.entidadeNome ?? ""),
    Sexo: r.sexo === 1 ? "M" : r.sexo === 0 ? "F" : "",
    ValorVR: r.valorAReceber,
    Tipo: "VR",
  }));

  const planilha = XLSX.utils.json_to_sheet(linhas);
  const livro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(livro, planilha, "VR");
  return XLSX.write(livro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/* ── 4. PDF de "Todos os lançamentos" (respeitando os filtros da tela) ── */

/** Lançamento (já filtrado) pronto pra entrar no PDF de "todos os lançamentos". */
export interface LancamentoParaPdf {
  dataDesconto: string; // ISO "YYYY-MM-DD"
  userNome: string;
  mes: number;
  ano: number;
  /** Grupo (campo) do mês — mostrado junto do mês quando informado. */
  grupo?: string;
  tipoLancamento: "DESCONTO" | "EXTRA";
  motivo: string | null;
  descontoAplicado: boolean;
  /** Nome de quem lançou (null em lançamentos anteriores à coluna existir). */
  criadoPorNome: string | null;
}

const MESES_LABEL_EXPORT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** "2026-10-15" -> "15/10/2026" (evita problema de fuso do new Date(iso)). */
function formatarDataIsoBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Gera o PDF de "Todos os lançamentos" — recebe a lista JÁ FILTRADA (nome,
 * mês, tipo, status) pelo chamador, então o PDF sempre reflete exatamente
 * o que a pessoa está vendo na tela na hora de gerar.
 */
export async function gerarRelatorioTodosLancamentosPdf(
  lancamentos: LancamentoParaPdf[],
  extraidoPor: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 30 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).font("Helvetica-Bold").text("Todos os Lançamentos de VR", { align: "center" });
    doc.moveDown(0.3);
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#555555")
      .text(`PDF Extraído Por: ${extraidoPor}    ${new Date().toLocaleString("pt-BR")}`);
    doc.moveDown(1);
    doc.fillColor("#000000");

    const colunas = [
      { chave: "data", titulo: "Data", largura: 65 },
      { chave: "colaborador", titulo: "Colaborador", largura: 160 },
      { chave: "mesRef", titulo: "Mês ref.", largura: 125 },
      { chave: "tipo", titulo: "Tipo", largura: 65 },
      { chave: "motivo", titulo: "Motivo", largura: 120 },
      { chave: "status", titulo: "Status", largura: 65 },
      { chave: "lancadoPor", titulo: "Lançado por", largura: 130 },
    ] as const;

    const inicioX = doc.page.margins.left;
    let y = doc.y;

    function desenharCabecalho() {
      let x = inicioX;
      doc.font("Helvetica-Bold").fontSize(10);
      for (const col of colunas) {
        doc.text(col.titulo, x, y, { width: col.largura });
        x += col.largura;
      }
      y += 18;
      doc
        .moveTo(inicioX, y)
        .lineTo(inicioX + colunas.reduce((s, c) => s + c.largura, 0), y)
        .strokeColor("#dddddd")
        .stroke();
      y += 6;
    }

    desenharCabecalho();
    doc.font("Helvetica").fontSize(9);

    for (const l of lancamentos) {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 30 });
        y = doc.page.margins.top;
        desenharCabecalho();
        doc.font("Helvetica").fontSize(9);
      }

      let x = inicioX;
      doc.fillColor("#000000").text(formatarDataIsoBr(l.dataDesconto), x, y, {
        width: colunas[0].largura,
      });
      x += colunas[0].largura;
      doc.text(l.userNome, x, y, { width: colunas[1].largura });
      x += colunas[1].largura;
      doc.text(
        `${MESES_LABEL_EXPORT[l.mes - 1]}/${l.ano}${l.grupo ? ` · ${l.grupo}` : ""}`,
        x,
        y,
        { width: colunas[2].largura },
      );
      x += colunas[2].largura;
      doc
        .fillColor(l.tipoLancamento === "DESCONTO" ? "#c0392b" : "#27ae60")
        .text(l.tipoLancamento === "DESCONTO" ? "Desconto" : "Extra", x, y, {
          width: colunas[3].largura,
        });
      x += colunas[3].largura;
      doc.fillColor("#000000").text(l.motivo ?? "—", x, y, { width: colunas[4].largura });
      x += colunas[4].largura;
      doc.text(l.descontoAplicado ? "Aplicado" : "Pendente", x, y, { width: colunas[5].largura });
      x += colunas[5].largura;
      doc.text(l.criadoPorNome ?? "—", x, y, { width: colunas[6].largura });

      y += 20;
    }

    doc.end();
  });
}
