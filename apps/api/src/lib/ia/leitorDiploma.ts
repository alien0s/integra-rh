import { getApiConfig } from "../../plugins/env.js";
import type {
  CursoQualificacaoInput,
  FormacaoAcademicaInput,
  IdiomaInput,
} from "../qualificacoes.js";

/**
 * Leitura de diploma/certificado/comprovante por IA (Gemini, suporta PDF e
 * imagem inline). Classifica o documento num dos 3 tipos do módulo de
 * Qualificações (ver db/migrations/013_qualificacoes.sql) e extrai os campos
 * já no formato aceito pelos POSTs de criação existentes
 * (qualificacoes.routes.ts) — quem chama só precisa completar `anexoUrl`/
 * `certificadoUrl` (a chave do storage, que só se sabe depois do upload) e
 * decidir o usuário (ver lib/usuarios.ts: buscarUsuariosPorNomeAproximado).
 *
 * Erra pro lado de "NAO_IDENTIFICADO" em vez de chutar — a tela de revisão
 * (front) é quem decide o que fazer com isso, nunca criamos um registro sem
 * confirmação humana (ver qualificacoes.routes.ts: POST /qualificacoes/*).
 */

export type TipoDocumentoDetectado =
  | "FORMACAO_ACADEMICA"
  | "CURSO"
  | "IDIOMA"
  | "NAO_IDENTIFICADO";

type FormacaoSemAnexo = Omit<FormacaoAcademicaInput, "anexoUrl">;
type CursoSemAnexo = Omit<CursoQualificacaoInput, "certificadoUrl">;

export type DocumentoExtraido =
  | { tipo: "FORMACAO_ACADEMICA"; nomeDetectado: string | null; dados: FormacaoSemAnexo }
  | { tipo: "CURSO"; nomeDetectado: string | null; dados: CursoSemAnexo }
  | { tipo: "IDIOMA"; nomeDetectado: string | null; dados: IdiomaInput }
  | { tipo: "NAO_IDENTIFICADO"; nomeDetectado: string | null; motivo: string };

const MIMETYPES_SUPORTADOS = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export class GeminiNaoConfiguradoError extends Error {
  constructor() {
    super("Leitura de diplomas por IA não configurada (defina GEMINI_API_KEY no .env).");
    this.name = "GeminiNaoConfiguradoError";
  }
}

export class FormatoNaoSuportadoError extends Error {
  constructor(mimetype: string) {
    super(`Formato não suportado para leitura por IA: ${mimetype} (use PDF, JPEG, PNG ou WebP).`);
    this.name = "FormatoNaoSuportadoError";
  }
}

export class LeituraIAError extends Error {
  constructor(motivo: string) {
    super(`Falha ao ler o documento com IA: ${motivo}`);
    this.name = "LeituraIAError";
  }
}

const PROMPT = `Você analisa um ÚNICO documento de qualificação profissional (diploma, histórico, certificado de curso/workshop, ou certificado de proficiência em idioma) enviado por um colaborador de uma empresa no Brasil.

Classifique o documento em EXATAMENTE um destes tipos e preencha SÓ o campo correspondente (deixe os outros dois objetos como null):

1. "FORMACAO_ACADEMICA" — diploma ou declaração de curso técnico, graduação, pós-graduação/especialização, MBA, mestrado ou doutorado. Preencha "formacao":
   - nivel: TECNICO | GRADUACAO | POS_GRADUACAO | MBA | MESTRADO | DOUTORADO
     (ex.: "Bacharelado"/"Licenciatura"/"Tecnólogo em X" → GRADUACAO se for curso superior pleno; "Curso Técnico em X" → TECNICO; "Especialização"/"Pós-graduação lato sensu" → POS_GRADUACAO; "MBA" → MBA; "Mestrado"/"Mestre" → MESTRADO; "Doutorado"/"Doutor" → DOUTORADO)
   - curso: nome do curso/área (ex.: "Administração de Empresas"), sem o nível junto (não escreva "Graduação em...", só o nome da área/curso)
   - instituicao: nome da instituição de ensino
   - anoInicio: ano de início (inteiro). Se não aparecer, estime como anoFim menos a duração típica do nível (ex.: graduação ~4 anos antes da conclusão), e avise isso no nomeDetectado não — apenas faça a melhor estimativa.
   - anoFim: ano de conclusão (inteiro) — null se o documento indicar que ainda está em andamento (situacao = EM_ANDAMENTO)
   - situacao: EM_ANDAMENTO | CONCLUIDO | TRANCADO (diploma emitido = CONCLUIDO quase sempre)

2. "CURSO" — certificado de curso livre, workshop, treinamento ou certificação profissional (NÃO é um diploma de nível acadêmico formal). Preencha "curso":
   - tipo: CERTIFICACAO (certificação profissional, ex.: certificação de ferramenta/metodologia) | CURSO (curso livre/profissionalizante) | WORKSHOP (oficina/workshop pontual)
   - nome: nome do curso/certificação
   - instituicao: quem emitiu/ministrou
   - cargaHoraria: horas totais (inteiro), null se não aparecer
   - dataEmissao: data de emissão/conclusão no formato "YYYY-MM-DD", null se não der pra determinar o dia exato (tente pelo menos o ano-mês com dia 01)
   - dataValidade: data de expiração "YYYY-MM-DD", null se não houver validade (comum em CURSO/WORKSHOP; mais comum em CERTIFICACAO)

3. "IDIOMA" — certificado de proficiência em idioma (ex.: TOEFL, IELTS, Cambridge, DELF, etc.). Preencha "idioma":
   - idioma: nome do idioma em português (ex.: "Inglês", "Espanhol", "Francês")
   - nivelCefr: A1 | A2 | B1 | B2 | C1 | C2 — converta a pontuação do exame pro CEFR equivalente mais próximo (ex.: TOEFL iBT ~72-94 ≈ B2, IELTS 6.0-6.5 ≈ B2, Cambridge FCE ≈ B2, CAE ≈ C1)
   - origemAvaliacao: sempre "TESTE_INTERNO" (é um teste formal de terceiros, não autodeclaração)
   - avaliadoEm: data do exame "YYYY-MM-DD", null se não aparecer

Se o documento não se encaixar em nenhum dos 3 tipos, ou estiver ilegível/não for um documento de qualificação, retorne tipo "NAO_IDENTIFICADO" com um "motivo" curto explicando por quê.

Em TODOS os casos, preencha "nomeDetectado" com o nome completo da PESSOA a quem o documento pertence, exatamente como escrito nele (não o nome da instituição) — null se não conseguir identificar.

Responda SOMENTE com o JSON no formato pedido, sem nenhum texto adicional.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    tipo: {
      type: "STRING",
      enum: ["FORMACAO_ACADEMICA", "CURSO", "IDIOMA", "NAO_IDENTIFICADO"],
    },
    nomeDetectado: { type: "STRING", nullable: true },
    motivo: { type: "STRING", nullable: true },
    formacao: {
      type: "OBJECT",
      nullable: true,
      properties: {
        nivel: {
          type: "STRING",
          enum: ["TECNICO", "GRADUACAO", "POS_GRADUACAO", "MBA", "MESTRADO", "DOUTORADO"],
        },
        curso: { type: "STRING" },
        instituicao: { type: "STRING" },
        anoInicio: { type: "INTEGER" },
        anoFim: { type: "INTEGER", nullable: true },
        situacao: { type: "STRING", enum: ["EM_ANDAMENTO", "CONCLUIDO", "TRANCADO"] },
      },
      required: ["nivel", "curso", "instituicao", "anoInicio", "situacao"],
    },
    curso: {
      type: "OBJECT",
      nullable: true,
      properties: {
        tipo: { type: "STRING", enum: ["CERTIFICACAO", "CURSO", "WORKSHOP"] },
        nome: { type: "STRING" },
        instituicao: { type: "STRING" },
        cargaHoraria: { type: "INTEGER", nullable: true },
        dataEmissao: { type: "STRING", nullable: true },
        dataValidade: { type: "STRING", nullable: true },
      },
      required: ["tipo", "nome", "instituicao"],
    },
    idioma: {
      type: "OBJECT",
      nullable: true,
      properties: {
        idioma: { type: "STRING" },
        nivelCefr: { type: "STRING", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
        origemAvaliacao: { type: "STRING", enum: ["AUTODECLARADO", "TESTE_INTERNO"] },
        avaliadoEm: { type: "STRING", nullable: true },
      },
      required: ["idioma", "nivelCefr", "origemAvaliacao"],
    },
  },
  required: ["tipo", "nomeDetectado"],
};

/** Formato bruto que o Gemini devolve (antes de virar o union tipado acima). */
interface RespostaBrutaGemini {
  tipo: TipoDocumentoDetectado;
  nomeDetectado: string | null;
  motivo?: string | null;
  formacao?: FormacaoSemAnexo | null;
  curso?: CursoSemAnexo | null;
  idioma?: IdiomaInput | null;
}

function montarUrl(modelo: string, apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

/** Pra quem chama checar ANTES de processar um lote inteiro, em vez de
 * descobrir arquivo por arquivo (todos dariam o mesmo erro). */
export function leitorDiplomaConfigurado(): boolean {
  return Boolean(getApiConfig().ia.geminiApiKey);
}

/**
 * Lê um PDF ou imagem e devolve os campos de qualificação extraídos.
 * Lança `GeminiNaoConfiguradoError` se a chave não estiver setada, e
 * `FormatoNaoSuportadoError`/`LeituraIAError` para os demais problemas —
 * quem chama decide como reportar isso na resposta HTTP.
 */
export async function lerDocumentoQualificacao(
  buffer: Buffer,
  mimetype: string,
): Promise<DocumentoExtraido> {
  const config = getApiConfig().ia;

  if (!config.geminiApiKey) {
    throw new GeminiNaoConfiguradoError();
  }
  if (!MIMETYPES_SUPORTADOS.has(mimetype)) {
    throw new FormatoNaoSuportadoError(mimetype);
  }

  const resposta = await fetch(montarUrl(config.geminiModel, config.geminiApiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: mimetype, data: buffer.toString("base64") } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
      },
    }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => "");
    throw new LeituraIAError(`Gemini respondeu HTTP ${resposta.status}: ${corpo.slice(0, 500)}`);
  }

  const payload = (await resposta.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const texto = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) {
    throw new LeituraIAError("Resposta da IA veio vazia ou num formato inesperado.");
  }

  let bruta: RespostaBrutaGemini;
  try {
    bruta = JSON.parse(texto);
  } catch {
    throw new LeituraIAError("A IA não devolveu um JSON válido.");
  }

  if (bruta.tipo === "FORMACAO_ACADEMICA" && bruta.formacao) {
    return { tipo: "FORMACAO_ACADEMICA", nomeDetectado: bruta.nomeDetectado, dados: bruta.formacao };
  }
  if (bruta.tipo === "CURSO" && bruta.curso) {
    return { tipo: "CURSO", nomeDetectado: bruta.nomeDetectado, dados: bruta.curso };
  }
  if (bruta.tipo === "IDIOMA" && bruta.idioma) {
    return { tipo: "IDIOMA", nomeDetectado: bruta.nomeDetectado, dados: bruta.idioma };
  }
  return {
    tipo: "NAO_IDENTIFICADO",
    nomeDetectado: bruta.nomeDetectado ?? null,
    motivo: bruta.motivo ?? "Não foi possível classificar o documento.",
  };
}
