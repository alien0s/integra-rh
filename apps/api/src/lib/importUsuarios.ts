import * as XLSX from "xlsx";

import {
  criarUsuarioImportado,
  getUsuarioIdPorEmail,
  listDepartamentosParaMatch,
  preencherVinculosVazios,
  resolverEntidadePorReferencia,
} from "./database.js";

/**
 * Importação de usuários a partir de planilha (CSV/Excel).
 * Lê os campos mais importantes — e-mail, nome e entidade — e cria os usuários
 * que ainda não existem. Os demais dados são preenchidos pelo APS no 1º login.
 */

const DOMINIO_CORP = "@adventistas.org";

/** Uma linha já normalizada da planilha. */
export interface LinhaPlanilha {
  email: string;
  nome: string;
  /** Referência da entidade (código APS de 6 dígitos ou nome). */
  entidade: string | null;
  /** Nome do departamento (casado por texto com a tabela). */
  departamento: string | null;
}

export interface ResultadoImportacao {
  total: number;
  criados: number;
  /** Já existiam e tiveram entidade/departamento preenchidos. */
  atualizados: number;
  /** Já existiam e nada mudou (ignorados). */
  ignorados: number;
  erros: { linha: number; email?: string; motivo: string }[];
}

/** Sinônimos de cabeçalho aceitos para cada campo (já normalizados). */
const SINONIMOS = {
  email: ["email", "e-mail", "e mail", "email corporativo", "mail"],
  nome: ["nome", "name", "nome completo", "professor", "funcionario"],
  entidade: [
    "entidade",
    "entity",
    "cod entidade",
    "cod_entidade",
    "codigo entidade",
    "entity code",
    "codigo aps",
    "cod aps",
    "unidade",
  ],
  departamento: ["departamento", "department", "setor", "depto", "area"],
} as const;

/** Normaliza um cabeçalho: sem acento, minúsculo, espaços colapsados. */
function normalizarChave(chave: string): string {
  return chave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Lê o buffer de um CSV/Excel e extrai as linhas (email/nome/entidade).
 * Usa a primeira aba; o cabeçalho é reconhecido por sinônimos, então a ordem
 * e o nome exato das colunas são flexíveis.
 */
export function parsePlanilhaUsuarios(buffer: Buffer): LinhaPlanilha[] {
  // Arquivos Excel (.xlsx/.xls modernos) são ZIP e começam com "PK"; o resto
  // tratamos como texto (CSV) decodificado em UTF-8 — senão acentos viram
  // mojibake (ex.: "Educação" → "EducaÃ§Ã£o") e o casamento por nome falha.
  const ehExcelZip = buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
  const workbook = ehExcelZip
    ? XLSX.read(buffer, { type: "buffer" })
    : XLSX.read(buffer.toString("utf8"), { type: "string", raw: true });

  const nomePrimeiraAba = workbook.SheetNames[0];
  if (!nomePrimeiraAba) return [];

  const linhas = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[nomePrimeiraAba],
    { defval: "" },
  );

  return linhas.map((linha) => {
    // Pré-normaliza as chaves da linha uma vez.
    const entradas = Object.entries(linha).map(
      ([chave, valor]) => [normalizarChave(chave), valor] as const,
    );

    const pegar = (alvos: readonly string[]): string => {
      for (const [chave, valor] of entradas) {
        if (alvos.includes(chave)) {
          const texto = String(valor ?? "").trim();
          if (texto) return texto;
        }
      }
      return "";
    };

    return {
      email: pegar(SINONIMOS.email).toLowerCase(),
      nome: pegar(SINONIMOS.nome),
      entidade: pegar(SINONIMOS.entidade) || null,
      departamento: pegar(SINONIMOS.departamento) || null,
    };
  });
}

/**
 * Cria os usuários novos da planilha. E-mails inválidos (fora do domínio) e já
 * existentes não são criados; retorna um resumo com contagens e erros por linha.
 */
export async function importarUsuarios(
  linhas: LinhaPlanilha[],
): Promise<ResultadoImportacao> {
  const resultado: ResultadoImportacao = {
    total: linhas.length,
    criados: 0,
    atualizados: 0,
    ignorados: 0,
    erros: [],
  };

  // Pré-carrega os departamentos e indexa por nome normalizado (sem acento/
  // caixa), para casar o texto da planilha com a tabela.
  const departamentos = await listDepartamentosParaMatch();
  const indiceDepartamentos = new Map<string, string>();
  for (const dep of departamentos) {
    const chave = normalizarChave(dep.nome);
    // Primeiro registro vence (evita sobrescrever em caso de nomes repetidos).
    if (!indiceDepartamentos.has(chave)) indiceDepartamentos.set(chave, dep.id);
  }

  /** Casa o nome do departamento com a tabela; null se não fizer sentido. */
  function resolverDepartamento(nome: string): string | null {
    return indiceDepartamentos.get(normalizarChave(nome)) ?? null;
  }

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    // +2: linha 1 é o cabeçalho e o índice é base 0.
    const numeroLinha = i + 2;

    if (!linha.email) {
      resultado.erros.push({ linha: numeroLinha, motivo: "E-mail ausente." });
      continue;
    }
    if (!linha.email.endsWith(DOMINIO_CORP)) {
      resultado.erros.push({
        linha: numeroLinha,
        email: linha.email,
        motivo: `E-mail fora do domínio ${DOMINIO_CORP}.`,
      });
      continue;
    }

    const entityId = linha.entidade
      ? await resolverEntidadePorReferencia(linha.entidade)
      : null;
    const departmentId = linha.departamento
      ? resolverDepartamento(linha.departamento)
      : null;

    // Já existe: completa entidade/departamento se estiverem vazios (não
    // sobrescreve). Assim reimportar preenche quem foi criado sem esses dados.
    const jaExisteId = await getUsuarioIdPorEmail(linha.email);
    if (jaExisteId) {
      try {
        const atualizou = await preencherVinculosVazios(jaExisteId, {
          entityId,
          departmentId,
        });
        if (atualizou) resultado.atualizados++;
        else resultado.ignorados++;
      } catch {
        resultado.ignorados++;
      }
      continue;
    }

    const nome = linha.nome || linha.email.split("@")[0];

    try {
      await criarUsuarioImportado({
        email: linha.email,
        nome,
        entityId,
        departmentId,
      });
      resultado.criados++;
    } catch (error) {
      resultado.erros.push({
        linha: numeroLinha,
        email: linha.email,
        motivo:
          error instanceof Error ? error.message : "Falha ao criar o usuário.",
      });
    }
  }

  return resultado;
}
