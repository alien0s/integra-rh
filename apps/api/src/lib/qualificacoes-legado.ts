import { getDatabase } from "./database.js";
import { buscarQualificacoesLegado, type CursoLegado } from "./mssql.js";
import type { NivelFormacao } from "./qualificacoes.js";

/**
 * Sincronização automática de formação acadêmica a partir do legado (APS) —
 * ver buscarQualificacoesLegado em lib/mssql.ts pra fonte dos dados (banco
 * EAV/virtual, chave T1_pk = id_employee, resolvida a partir do CPF).
 *
 * O legado não guarda nível acadêmico por curso (só o nome do curso e,
 * separado, a escolaridade geral da pessoa) — por isso deduzirNivel()
 * classifica cada curso por palavra-chave no próprio nome. Também não guarda
 * "ano que entrou" nenhuma coluna — por isso ano_inicio fica sempre NULL.
 */

interface RegraNivel {
  nivel: NivelFormacao;
  palavras: string[];
}

/**
 * Regras aplicadas em ordem — a primeira cujo nome do curso contenha alguma
 * das palavras vence. Editável: ajustar palavras-chave aqui não muda a
 * lógica de deduzirNivel(). Fallback (nenhuma regra casa) = GRADUACAO — a
 * maioria dos nomes do catálogo do legado não tem prefixo reconhecível (ex.:
 * "Direito", "Pedagogia"), então cai aqui; é uma dedução, não uma certeza,
 * por isso toda linha sincronizada entra com nivel_deduzido = TRUE e
 * status = 'PENDENTE' (ver sincronizarCurso).
 */
export const REGRAS_NIVEL: RegraNivel[] = [
  { nivel: "DOUTORADO", palavras: ["doutorado", "pos doutorado", "phd"] },
  { nivel: "MESTRADO", palavras: ["mestrado", "mestre", "master"] },
  { nivel: "MBA", palavras: ["mba"] },
  {
    nivel: "POS_GRADUACAO",
    palavras: ["especializa", "pos-graduacao", "pos graduacao", "lato sensu"],
  },
  { nivel: "TECNICO", palavras: ["tecnico", "tecnologo", "tecnologia em"] },
];

/** minúsculas + sem acento, pra casar as palavras-chave com segurança. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Deduz o nível acadêmico do nome de um curso (o legado não guarda isso por
 * curso — só o nome). Fallback GRADUACAO quando nenhuma regra casa (ver
 * REGRAS_NIVEL) — nunca deixa de classificar, mas o resultado é só um
 * palpite (ver nivel_deduzido em sincronizarCurso).
 *
 * A escolaridade geral da pessoa (relacionamento 98695, um valor único como
 * "Mestrado"/"Ensino Médio Completo") NÃO passa por aqui — não é um curso,
 * é um campo separado (ver sincronizarQualificacoesLegado, users.escolaridade).
 */
export function deduzirNivel(nomeCurso: string): NivelFormacao {
  const normalizado = normalizar(nomeCurso);
  for (const regra of REGRAS_NIVEL) {
    if (regra.palavras.some((palavra) => normalizado.includes(normalizar(palavra)))) {
      return regra.nivel;
    }
  }
  return "GRADUACAO";
}

const INSTITUICAO_FALLBACK = "Não informado";

export interface ResultadoSincronizacaoQualificacoes {
  escolaridadeAtualizada: boolean;
  academicasInseridas: number;
  academicasAtualizadas: number;
  ignorados: number;
}

function anoDe(dataIso: string): number {
  return Number(dataIso.slice(0, 4));
}

async function sincronizarCurso(
  userId: string,
  curso: CursoLegado,
  resultado: ResultadoSincronizacaoQualificacoes,
): Promise<void> {
  if (!curso.conclusao) {
    resultado.ignorados++;
    return;
  }

  const sql = getDatabase();
  const instituicao = curso.instituicao || INSTITUICAO_FALLBACK;
  const ano = anoDe(curso.conclusao);

  const [existente] = await sql<{ id: string; instituicao: string; ano_fim: number | null }[]>`
    SELECT id, instituicao, ano_fim FROM qualificacoes_academicas
    WHERE user_id = ${userId} AND legado_curso_id = ${curso.idCurso}
    LIMIT 1
  `;

  if (!existente) {
    // Nível é dedução, não fonte autoritativa — entra pendente, igual ao
    // fluxo manual do colaborador (ver NewGraduacaoModal.tsx), pro RH
    // revisar antes de aparecer no perfil público.
    const nivel = deduzirNivel(curso.nome);
    await sql`
      INSERT INTO qualificacoes_academicas (
        user_id, nivel, curso, instituicao, ano_inicio, ano_fim, situacao,
        status, nivel_deduzido, legado_curso_id
      ) VALUES (
        ${userId}, ${nivel}, ${curso.nome}, ${instituicao}, NULL, ${ano}, 'CONCLUIDO',
        'PENDENTE', TRUE, ${curso.idCurso}
      )
    `;
    resultado.academicasInseridas++;
    return;
  }

  // Linha já existe — só atualiza dados que podem legitimamente mudar no
  // legado (instituição/ano de conclusão). Nunca reatualiza nivel/status/
  // nivel_deduzido: se o RH já revisou (aprovou/recusou/corrigiu o nível),
  // um login futuro não pode desfazer essa decisão.
  if (existente.instituicao !== instituicao || existente.ano_fim !== ano) {
    await sql`
      UPDATE qualificacoes_academicas SET instituicao = ${instituicao}, ano_fim = ${ano}
      WHERE id = ${existente.id}
    `;
    resultado.academicasAtualizadas++;
  }
}

/**
 * Sincroniza a formação acadêmica de UM funcionário a partir do legado (ver
 * buscarQualificacoesLegado em lib/mssql.ts) — chamado no login (ver
 * findOrCreateUsuarioLocal/findOrCreateUser em lib/usuarios.ts).
 *
 * Escolaridade (grau de instrução) vira users.escolaridade — sempre
 * atualizado quando muda (pode subir com o tempo, diferente dos campos
 * "preenche só se vazio" como codigo_aps). Cursos viram linhas em
 * qualificacoes_academicas (ver deduzirNivel/sincronizarCurso), marcadas com
 * legado_curso_id pra deduplicar/atualizar em logins futuros — nunca mexe
 * numa linha sem esse marcador (cadastrada por um humano).
 *
 * Nunca lança: qualquer erro (MSSQL indisponível, etc.) é logado e engolido,
 * pra nunca derrubar o login por causa disso.
 */
export async function sincronizarQualificacoesLegado(
  userId: string,
): Promise<ResultadoSincronizacaoQualificacoes> {
  const resultado: ResultadoSincronizacaoQualificacoes = {
    escolaridadeAtualizada: false,
    academicasInseridas: 0,
    academicasAtualizadas: 0,
    ignorados: 0,
  };
  try {
    const sql = getDatabase();
    const [u] = await sql<{ cpf: string | null; escolaridade: string | null }[]>`
      SELECT cpf, escolaridade FROM users WHERE id = ${userId} LIMIT 1
    `;
    const cpf = u?.cpf?.replace(/\D/g, "") ?? "";
    if (!cpf) return resultado;

    const legado = await buscarQualificacoesLegado(cpf);
    if (!legado) return resultado;

    if (legado.escolaridade && legado.escolaridade !== u.escolaridade) {
      await sql`UPDATE users SET escolaridade = ${legado.escolaridade} WHERE id = ${userId}`;
      resultado.escolaridadeAtualizada = true;
    }

    for (const curso of legado.cursos) {
      await sincronizarCurso(userId, curso, resultado);
    }

    return resultado;
  } catch (error) {
    console.error(`[qualificacoes] falha ao sincronizar legado do usuário ${userId}:`, error);
    return resultado;
  }
}
