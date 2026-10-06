import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type { FastifyInstance } from "fastify";

import {
  aprovarCurso,
  aprovarFormacao,
  aprovarIdioma,
  criarCurso,
  criarFormacao,
  criarOuAtualizarIdioma,
  excluirCurso,
  excluirFormacao,
  excluirIdioma,
  getAnexoCurso,
  getAnexoFormacao,
  getCursoPorId,
  getFormacaoPorId,
  getIdiomaPorId,
  getQualificacoesResumo,
  listCursosAprovados,
  listCursosPendentes,
  listFormacoesAprovadas,
  listFormacoesPendentes,
  listFuncionariosComQualificacoes,
  listIdiomasAprovados,
  listIdiomasPendentes,
  listMeusCursos,
  listMeusIdiomas,
  listMinhasFormacoes,
  recusarCurso,
  recusarFormacao,
  recusarIdioma,
  removerAnexoFormacao,
  removerCertificadoCurso,
  salvarAnexoFormacao,
  salvarCertificadoCurso,
  type CursoQualificacao,
  type CursoQualificacaoInput,
  type FormacaoAcademica,
  type FormacaoAcademicaInput,
  type FuncionarioQualificacoesDTO,
  type Idioma,
  type IdiomaInput,
  type QualificacoesResumoDTO,
} from "../lib/qualificacoes.js";
import { rodaComoUsuario } from "../lib/database.js";
import {
  FormatoNaoSuportadoError,
  GeminiNaoConfiguradoError,
  LeituraIAError,
  leitorDiplomaConfigurado,
  lerDocumentoQualificacao,
  type TipoDocumentoDetectado,
} from "../lib/ia/leitorDiploma.js";
import { emitirParaPapeis, emitirParaUsuario } from "../lib/notificacoes.js";
import { deleteObject, getObjectStream, uploadObject } from "../lib/storage.js";
import { buscarUsuariosPorNomeAproximado, type CandidatoUsuario } from "../lib/usuarios.js";
import { exigirAdminOuPapeisDuranteBeta } from "../plugins/auth.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/**
 * Todo handler deste arquivo que toca qualificacoes_academicas/cursos/idiomas
 * roda dentro de `rodaComoUsuario` — RLS ligado nessas 3 tabelas (ver
 * migration 013_qualificacoes.sql). Exceções: `/resumo` e `/funcionarios`
 * só contam registros `status = 'APROVADO'`, que a policy de leitura já
 * libera sem precisar de identidade nenhuma — ficam de fora.
 */

/** Mimetypes aceitos pra diploma/certificado — imagem (foto do documento) ou PDF. */
const TIPOS_ANEXO_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Resultado da leitura de UM arquivo em POST /qualificacoes/ler-diplomas. */
interface ResultadoLeituraDiploma {
  nomeArquivo: string;
  status: "pronto_para_revisao" | "nao_identificado" | "erro";
  tipo?: TipoDocumentoDetectado;
  nomeDetectado?: string | null;
  /** Já com anexoUrl/certificadoUrl preenchido com a chave do storage —
   * pronto pra mandar direto pro POST de criação correspondente. */
  dados?: FormacaoAcademicaInput | CursoQualificacaoInput | IdiomaInput;
  candidatosUsuario?: CandidatoUsuario[];
  motivo?: string;
}

/** Papéis com permissão para moderar (aprovar/recusar/excluir de qualquer pessoa). */
const PAPEIS_RH = new Set(["ADMIN", "RH"]);

/**
 * Papel que recebe a notificação de "novo cadastro pendente" — o mesmo que
 * modera (PAPEIS_RH acima). A notificação é ACIONÁVEL (`requerAcao: true`):
 * o RH aprova/recusa direto pelo cartão da notificação (ver
 * lib/notificacoes.ts: acionavelPorEtapa soma o JOIN nas 3 tabelas de
 * qualificações pra saber se ainda está PENDENTE — some da lista assim que
 * alguém decide).
 */
const PAPEIS_NOTIFICAR_NOVA_QUALIFICACAO = ["RH"];

const TIPO_CURSO_LABEL: Record<CursoQualificacaoInput["tipo"], string> = {
  CERTIFICACAO: "uma certificação",
  CURSO: "um curso",
  WORKSHOP: "um workshop",
};

function ehRh(papelCodigo: string | undefined): boolean {
  return Boolean(papelCodigo && PAPEIS_RH.has(papelCodigo));
}

/**
 * Rotas de Cursos e Qualificações. Toda leitura "pública" (visão de outra
 * pessoa, dashboards) só devolve registros já APROVADOS — o front nunca
 * recebe/exibe o status de aprovação fora da própria gestão do colaborador
 * e da fila de moderação do RH.
 */
export async function qualificacoesRoutes(app: FastifyInstance) {
  // Lançamento beta (ver exigirAdminOuPapeisDuranteBeta): ADMIN e RH por
  // enquanto — RH já modera (aprovar/recusar) cursos/formações/idiomas nessa
  // tela (ver PAPEIS_RH/ehRh abaixo), então também passa pelo bloqueio do
  // lançamento. Espelha o front (RequireLancamentoBeta em /cursos, App.tsx).
  // Roda em TODAS as rotas deste arquivo (hook de plugin, depois de
  // app.authenticate).
  app.addHook("preHandler", exigirAdminOuPapeisDuranteBeta(PAPEIS_RH));

  /* ── Leitura — próprio colaborador (gerencia os próprios registros) ──── */

  app.get<{
    Reply: ApiResponse<{
      formacoes: FormacaoAcademica[];
      cursos: CursoQualificacao[];
      idiomas: Idioma[];
    }>;
  }>(
    "/qualificacoes/minhas",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Minhas qualificações (inclui pendentes/recusadas, pra eu gerenciar)",
      },
    },
    async (request) => {
      return rodaComoUsuario(request.user, async () => {
        const userId = request.user.id;
        const [formacoes, cursos, idiomas] = await Promise.all([
          listMinhasFormacoes(userId),
          listMeusCursos(userId),
          listMeusIdiomas(userId),
        ]);
        return { data: { formacoes, cursos, idiomas } };
      });
    },
  );

  /* ── Leitura — visão pública (perfil de outra pessoa) ─────────────────── */

  app.get<{
    Params: { usuarioId: string };
    Reply: ApiResponse<{
      formacoes: Omit<FormacaoAcademica, "status" | "motivoRecusa">[];
      cursos: Omit<CursoQualificacao, "status" | "motivoRecusa">[];
      idiomas: Omit<Idioma, "status" | "motivoRecusa">[];
    }>;
  }>(
    "/qualificacoes/usuario/:usuarioId",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Qualificações aprovadas de um colaborador (visão de perfil)",
      },
    },
    async (request) => {
      return rodaComoUsuario(request.user, async () => {
        const { usuarioId } = request.params;
        const [formacoes, cursos, idiomas] = await Promise.all([
          listFormacoesAprovadas(usuarioId),
          listCursosAprovados(usuarioId),
          listIdiomasAprovados(usuarioId),
        ]);
        return { data: { formacoes, cursos, idiomas } };
      });
    },
  );

  /* ── Leitura — dashboard "Visão geral" ─────────────────────────────────── */

  app.get<{ Reply: ApiResponse<QualificacoesResumoDTO> }>(
    "/qualificacoes/resumo",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Estatísticas agregadas (cards do topo da Visão geral)",
      },
    },
    async () => ({ data: await getQualificacoesResumo() }),
  );

  app.get<{ Reply: ApiListResponse<FuncionarioQualificacoesDTO> }>(
    "/qualificacoes/funcionarios",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Colaboradores com a contagem de qualificações aprovadas (tabela da Visão geral)",
      },
    },
    async () => {
      const funcionarios = await listFuncionariosComQualificacoes();
      return { data: funcionarios, total: funcionarios.length };
    },
  );

  /* ── Leitura — fila de moderação (RH/Admin) ────────────────────────────── */

  app.get<{
    Reply:
      | ApiResponse<{
          formacoes: FormacaoAcademica[];
          cursos: CursoQualificacao[];
          idiomas: Idioma[];
        }>
      | { message: string };
  }>(
    "/qualificacoes/pendentes",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Fila de moderação — tudo que está PENDENTE (RH/Admin)",
      },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para ver a fila de moderação." });
      }
      return rodaComoUsuario(request.user, async () => {
        const [formacoes, cursos, idiomas] = await Promise.all([
          listFormacoesPendentes(),
          listCursosPendentes(),
          listIdiomasPendentes(),
        ]);
        return { data: { formacoes, cursos, idiomas } };
      });
    },
  );

  /* ── Formação acadêmica — escrita ──────────────────────────────────────── */

  app.post<{
    Body: FormacaoAcademicaInput;
    Reply: ApiResponse<FormacaoAcademica>;
  }>(
    "/qualificacoes/formacoes",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Cadastra uma formação acadêmica (entra como PENDENTE)",
        body: {
          type: "object",
          required: ["nivel", "curso", "instituicao", "anoInicio", "situacao"],
          properties: {
            nivel: {
              type: "string",
              enum: ["TECNICO", "GRADUACAO", "POS_GRADUACAO", "MBA", "MESTRADO", "DOUTORADO"],
            },
            curso: { type: "string", minLength: 1 },
            instituicao: { type: "string", minLength: 1 },
            anoInicio: { type: "number" },
            anoFim: { type: ["number", "null"] },
            situacao: { type: "string", enum: ["EM_ANDAMENTO", "CONCLUIDO", "TRANCADO"] },
            anexoUrl: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const criada = await criarFormacao(request.user.id, {
          ...request.body,
          anoFim: request.body.anoFim ?? null,
          anexoUrl: request.body.anexoUrl ?? null,
        });

        await emitirParaPapeis(PAPEIS_NOTIFICAR_NOVA_QUALIFICACAO, {
          atorId: request.user.id,
          tipo: "CURSO_FORMACAO_CADASTRADA",
          acao: "cadastrou uma formação acadêmica",
          detalhe: criada.curso,
          referenciaTabela: "qualificacoes_academicas",
          referenciaId: criada.id,
          requerAcao: true,
        });

        return reply.code(201).send({ data: criada });
      });
    },
  );

  /**
   * Detalhe de UMA formação (qualquer status) — usada pelo dialog que abre
   * ao clicar numa notificação de qualificação (ver DetalheQualificacaoDialog
   * no front). Só RH/Admin (mesma regra de quem modera).
   */
  app.get<{
    Params: { id: string };
    Reply: ApiResponse<FormacaoAcademica> | { message: string };
  }>(
    "/qualificacoes/formacoes/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Detalhe de uma formação acadêmica (RH/Admin)" },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para ver este registro." });
      }
      return rodaComoUsuario(request.user, async () => {
        const formacao = await getFormacaoPorId(request.params.id);
        if (!formacao) {
          return reply.code(404).send({ message: "Formação não encontrada." });
        }
        return { data: formacao };
      });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/formacoes/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Exclui uma formação acadêmica" },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const excluida = await excluirFormacao(
          request.params.id,
          request.user.id,
          ehRh(request.user.papelCodigo),
        );
        if (!excluida) {
          return reply.code(404).send({ message: "Formação não encontrada." });
        }
        return reply.code(204).send(undefined);
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<FormacaoAcademica> | { message: string };
  }>(
    "/qualificacoes/formacoes/:id/aprovar",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Aprova uma formação acadêmica (RH/Admin)" },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para aprovar." });
      }
      return rodaComoUsuario(request.user, async () => {
        const dto = await aprovarFormacao(request.params.id, request.user.id);
        if (!dto) {
          return reply.code(404).send({ message: "Formação não encontrada ou já decidida." });
        }
        await emitirParaUsuario(dto.userId, {
          atorId: request.user.id,
          tipo: "CURSO_FORMACAO_APROVADA",
          acao: "aprovou sua formação acadêmica",
          detalhe: dto.curso,
          referenciaTabela: "qualificacoes_academicas",
          referenciaId: dto.id,
        });
        return { data: dto };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { motivo: string };
    Reply: ApiResponse<FormacaoAcademica> | { message: string };
  }>(
    "/qualificacoes/formacoes/:id/recusar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Recusa uma formação acadêmica com justificativa (RH/Admin)",
        body: {
          type: "object",
          required: ["motivo"],
          properties: { motivo: { type: "string", minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para recusar." });
      }
      return rodaComoUsuario(request.user, async () => {
        const dto = await recusarFormacao(request.params.id, request.user.id, request.body.motivo);
        if (!dto) {
          return reply.code(404).send({ message: "Formação não encontrada ou já decidida." });
        }
        await emitirParaUsuario(dto.userId, {
          atorId: request.user.id,
          tipo: "CURSO_FORMACAO_RECUSADA",
          acao: "recusou sua formação acadêmica",
          detalhe: request.body.motivo,
          referenciaTabela: "qualificacoes_academicas",
          referenciaId: dto.id,
        });
        return { data: dto };
      });
    },
  );

  /* ── Formação acadêmica — anexo (diploma/comprovante) ─────────────────── */

  app.post<{ Params: { id: string }; Reply: ApiResponse<FormacaoAcademica> | { message: string } }>(
    "/qualificacoes/formacoes/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Envia (ou troca) o diploma/comprovante de uma formação acadêmica",
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const { id } = request.params;
        const registro = await getAnexoFormacao(id);
        if (!registro) {
          return reply.code(404).send({ message: "Formação não encontrada." });
        }
        const podeQualquer = ehRh(request.user.papelCodigo);
        if (registro.userId !== request.user.id && !podeQualquer) {
          return reply.code(403).send({ message: "Sem permissão para anexar a este registro." });
        }

        const file = await request.file();
        if (!file) {
          return reply.code(400).send({ message: "Nenhum arquivo enviado" });
        }
        if (!TIPOS_ANEXO_PERMITIDOS.includes(file.mimetype)) {
          return reply.code(415).send({ message: "Formato inválido. Use JPEG, PNG, WebP ou PDF." });
        }

        const buffer = await file.toBuffer();
        const extensao = extname(file.filename) || ".pdf";
        const chave = `qualificacoes/formacoes/${id}/${randomUUID()}${extensao}`;
        await uploadObject(chave, buffer, file.mimetype);

        const atualizada = await salvarAnexoFormacao(id, request.user.id, chave, podeQualquer);
        if (!atualizada) {
          return reply.code(404).send({ message: "Formação não encontrada." });
        }
        return { data: atualizada };
      });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/formacoes/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Remove o anexo de uma formação acadêmica" },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const { id } = request.params;
        const registro = await getAnexoFormacao(id);
        if (!registro) {
          return reply.code(404).send({ message: "Formação não encontrada." });
        }
        const podeQualquer = ehRh(request.user.papelCodigo);
        if (registro.userId !== request.user.id && !podeQualquer) {
          return reply.code(403).send({ message: "Sem permissão para remover este anexo." });
        }
        if (registro.chave) {
          try {
            await deleteObject(registro.chave);
          } catch (error) {
            request.log.warn({ error, chave: registro.chave }, "Falha ao remover anexo do storage");
          }
        }
        await removerAnexoFormacao(id, request.user.id, podeQualquer);
        return reply.code(204).send(undefined);
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/qualificacoes/formacoes/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Baixa/visualiza o anexo de uma formação acadêmica",
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const { id } = request.params;
        const registro = await getAnexoFormacao(id);
        if (!registro || !registro.chave) {
          return reply.code(404).send({ message: "Sem anexo." });
        }
        // Só o dono, RH/Admin, ou — já aprovado — qualquer colaborador autenticado.
        const podeVer =
          registro.userId === request.user.id ||
          ehRh(request.user.papelCodigo) ||
          registro.status === "APROVADO";
        if (!podeVer) {
          return reply.code(403).send({ message: "Sem permissão para ver este anexo." });
        }

        try {
          const { body, contentType } = await getObjectStream(registro.chave);
          reply.header("Content-Type", contentType);
          return reply.send(body);
        } catch {
          return reply.code(404).send({ message: "Anexo indisponível" });
        }
      });
    },
  );

  /* ── Cursos, workshops e certificações — escrita ──────────────────────── */

  app.post<{
    Body: CursoQualificacaoInput;
    Reply: ApiResponse<CursoQualificacao>;
  }>(
    "/qualificacoes/cursos",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Cadastra um curso/workshop/certificação (entra como PENDENTE)",
        body: {
          type: "object",
          required: ["tipo", "nome", "instituicao"],
          properties: {
            tipo: { type: "string", enum: ["CERTIFICACAO", "CURSO", "WORKSHOP"] },
            nome: { type: "string", minLength: 1 },
            instituicao: { type: "string", minLength: 1 },
            cargaHoraria: { type: ["number", "null"] },
            dataEmissao: { type: ["string", "null"] },
            dataValidade: { type: ["string", "null"] },
            certificadoUrl: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const criado = await criarCurso(request.user.id, {
          ...request.body,
          cargaHoraria: request.body.cargaHoraria ?? null,
          dataEmissao: request.body.dataEmissao ?? null,
          dataValidade: request.body.dataValidade ?? null,
          certificadoUrl: request.body.certificadoUrl ?? null,
        });

        await emitirParaPapeis(PAPEIS_NOTIFICAR_NOVA_QUALIFICACAO, {
          atorId: request.user.id,
          tipo: "CURSO_REGISTRO_CADASTRADO",
          acao: `cadastrou ${TIPO_CURSO_LABEL[criado.tipo]}`,
          detalhe: criado.nome,
          referenciaTabela: "qualificacoes_cursos",
          referenciaId: criado.id,
          requerAcao: true,
        });

        return reply.code(201).send({ data: criado });
      });
    },
  );

  /** Detalhe de UM curso/workshop/certificação (qualquer status). Só RH/Admin. */
  app.get<{
    Params: { id: string };
    Reply: ApiResponse<CursoQualificacao> | { message: string };
  }>(
    "/qualificacoes/cursos/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Detalhe de um curso/workshop/certificação (RH/Admin)" },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para ver este registro." });
      }
      return rodaComoUsuario(request.user, async () => {
        const curso = await getCursoPorId(request.params.id);
        if (!curso) {
          return reply.code(404).send({ message: "Registro não encontrado." });
        }
        return { data: curso };
      });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/cursos/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Exclui um curso/workshop/certificação" },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const excluido = await excluirCurso(
          request.params.id,
          request.user.id,
          ehRh(request.user.papelCodigo),
        );
        if (!excluido) {
          return reply.code(404).send({ message: "Registro não encontrado." });
        }
        return reply.code(204).send(undefined);
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<CursoQualificacao> | { message: string };
  }>(
    "/qualificacoes/cursos/:id/aprovar",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Aprova um curso/workshop/certificação (RH/Admin)" },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para aprovar." });
      }
      return rodaComoUsuario(request.user, async () => {
        const dto = await aprovarCurso(request.params.id, request.user.id);
        if (!dto) {
          return reply.code(404).send({ message: "Registro não encontrado ou já decidido." });
        }
        await emitirParaUsuario(dto.userId, {
          atorId: request.user.id,
          tipo: "CURSO_REGISTRO_APROVADO",
          acao: `aprovou ${TIPO_CURSO_LABEL[dto.tipo]}`,
          detalhe: dto.nome,
          referenciaTabela: "qualificacoes_cursos",
          referenciaId: dto.id,
        });
        return { data: dto };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { motivo: string };
    Reply: ApiResponse<CursoQualificacao> | { message: string };
  }>(
    "/qualificacoes/cursos/:id/recusar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Recusa um curso/workshop/certificação com justificativa (RH/Admin)",
        body: {
          type: "object",
          required: ["motivo"],
          properties: { motivo: { type: "string", minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para recusar." });
      }
      return rodaComoUsuario(request.user, async () => {
        const dto = await recusarCurso(request.params.id, request.user.id, request.body.motivo);
        if (!dto) {
          return reply.code(404).send({ message: "Registro não encontrado ou já decidido." });
        }
        await emitirParaUsuario(dto.userId, {
          atorId: request.user.id,
          tipo: "CURSO_REGISTRO_RECUSADO",
          acao: `recusou ${TIPO_CURSO_LABEL[dto.tipo]}`,
          detalhe: request.body.motivo,
          referenciaTabela: "qualificacoes_cursos",
          referenciaId: dto.id,
        });
        return { data: dto };
      });
    },
  );

  /* ── Cursos, workshops e certificações — anexo (certificado) ──────────── */

  app.post<{ Params: { id: string }; Reply: ApiResponse<CursoQualificacao> | { message: string } }>(
    "/qualificacoes/cursos/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Envia (ou troca) o certificado de um curso/workshop/certificação",
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const { id } = request.params;
        const registro = await getAnexoCurso(id);
        if (!registro) {
          return reply.code(404).send({ message: "Registro não encontrado." });
        }
        const podeQualquer = ehRh(request.user.papelCodigo);
        if (registro.userId !== request.user.id && !podeQualquer) {
          return reply.code(403).send({ message: "Sem permissão para anexar a este registro." });
        }

        const file = await request.file();
        if (!file) {
          return reply.code(400).send({ message: "Nenhum arquivo enviado" });
        }
        if (!TIPOS_ANEXO_PERMITIDOS.includes(file.mimetype)) {
          return reply.code(415).send({ message: "Formato inválido. Use JPEG, PNG, WebP ou PDF." });
        }

        const buffer = await file.toBuffer();
        const extensao = extname(file.filename) || ".pdf";
        const chave = `qualificacoes/cursos/${id}/${randomUUID()}${extensao}`;
        await uploadObject(chave, buffer, file.mimetype);

        const atualizado = await salvarCertificadoCurso(id, request.user.id, chave, podeQualquer);
        if (!atualizado) {
          return reply.code(404).send({ message: "Registro não encontrado." });
        }
        return { data: atualizado };
      });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/cursos/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Remove o certificado de um curso/workshop/certificação",
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const { id } = request.params;
        const registro = await getAnexoCurso(id);
        if (!registro) {
          return reply.code(404).send({ message: "Registro não encontrado." });
        }
        const podeQualquer = ehRh(request.user.papelCodigo);
        if (registro.userId !== request.user.id && !podeQualquer) {
          return reply.code(403).send({ message: "Sem permissão para remover este anexo." });
        }
        if (registro.chave) {
          try {
            await deleteObject(registro.chave);
          } catch (error) {
            request.log.warn({ error, chave: registro.chave }, "Falha ao remover anexo do storage");
          }
        }
        await removerCertificadoCurso(id, request.user.id, podeQualquer);
        return reply.code(204).send(undefined);
      });
    },
  );

  app.get<{ Params: { id: string } }>(
    "/qualificacoes/cursos/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Baixa/visualiza o certificado de um curso/workshop/certificação",
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const { id } = request.params;
        const registro = await getAnexoCurso(id);
        if (!registro || !registro.chave) {
          return reply.code(404).send({ message: "Sem anexo." });
        }
        const podeVer =
          registro.userId === request.user.id ||
          ehRh(request.user.papelCodigo) ||
          registro.status === "APROVADO";
        if (!podeVer) {
          return reply.code(403).send({ message: "Sem permissão para ver este anexo." });
        }

        try {
          const { body, contentType } = await getObjectStream(registro.chave);
          reply.header("Content-Type", contentType);
          return reply.send(body);
        } catch {
          return reply.code(404).send({ message: "Anexo indisponível" });
        }
      });
    },
  );

  /* ── Idiomas — escrita ─────────────────────────────────────────────────── */

  app.post<{
    Body: IdiomaInput;
    Reply: ApiResponse<Idioma>;
  }>(
    "/qualificacoes/idiomas",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Cadastra/atualiza um idioma (entra/volta como PENDENTE)",
        body: {
          type: "object",
          required: ["idioma", "nivelCefr", "origemAvaliacao"],
          properties: {
            idioma: { type: "string", minLength: 1 },
            nivelCefr: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1", "C2"] },
            origemAvaliacao: { type: "string", enum: ["AUTODECLARADO", "TESTE_INTERNO"] },
            avaliadoEm: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const salvo = await criarOuAtualizarIdioma(request.user.id, {
          ...request.body,
          avaliadoEm: request.body.avaliadoEm ?? null,
        });

        await emitirParaPapeis(PAPEIS_NOTIFICAR_NOVA_QUALIFICACAO, {
          atorId: request.user.id,
          tipo: "CURSO_IDIOMA_CADASTRADO",
          acao: "cadastrou um idioma",
          detalhe: `${salvo.idioma} (${salvo.nivelCefr})`,
          referenciaTabela: "qualificacoes_idiomas",
          referenciaId: salvo.id,
          requerAcao: true,
        });

        return reply.code(201).send({ data: salvo });
      });
    },
  );

  /** Detalhe de UM idioma (qualquer status). Só RH/Admin. */
  app.get<{
    Params: { id: string };
    Reply: ApiResponse<Idioma> | { message: string };
  }>(
    "/qualificacoes/idiomas/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Detalhe de um idioma (RH/Admin)" },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para ver este registro." });
      }
      return rodaComoUsuario(request.user, async () => {
        const idioma = await getIdiomaPorId(request.params.id);
        if (!idioma) {
          return reply.code(404).send({ message: "Idioma não encontrado." });
        }
        return { data: idioma };
      });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/idiomas/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Exclui um idioma" },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const excluido = await excluirIdioma(
          request.params.id,
          request.user.id,
          ehRh(request.user.papelCodigo),
        );
        if (!excluido) {
          return reply.code(404).send({ message: "Idioma não encontrado." });
        }
        return reply.code(204).send(undefined);
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<Idioma> | { message: string };
  }>(
    "/qualificacoes/idiomas/:id/aprovar",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Aprova um idioma (RH/Admin)" },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para aprovar." });
      }
      return rodaComoUsuario(request.user, async () => {
        const dto = await aprovarIdioma(request.params.id, request.user.id);
        if (!dto) {
          return reply.code(404).send({ message: "Idioma não encontrado ou já decidido." });
        }
        await emitirParaUsuario(dto.userId, {
          atorId: request.user.id,
          tipo: "CURSO_IDIOMA_APROVADO",
          acao: "aprovou seu idioma",
          detalhe: `${dto.idioma} (${dto.nivelCefr})`,
          referenciaTabela: "qualificacoes_idiomas",
          referenciaId: dto.id,
        });
        return { data: dto };
      });
    },
  );

  app.patch<{
    Params: { id: string };
    Body: { motivo: string };
    Reply: ApiResponse<Idioma> | { message: string };
  }>(
    "/qualificacoes/idiomas/:id/recusar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Recusa um idioma com justificativa (RH/Admin)",
        body: {
          type: "object",
          required: ["motivo"],
          properties: { motivo: { type: "string", minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!ehRh(request.user.papelCodigo)) {
        return reply.code(403).send({ message: "Sem permissão para recusar." });
      }
      return rodaComoUsuario(request.user, async () => {
        const dto = await recusarIdioma(request.params.id, request.user.id, request.body.motivo);
        if (!dto) {
          return reply.code(404).send({ message: "Idioma não encontrado ou já decidido." });
        }
        await emitirParaUsuario(dto.userId, {
          atorId: request.user.id,
          tipo: "CURSO_IDIOMA_RECUSADO",
          acao: "recusou seu idioma",
          detalhe: request.body.motivo,
          referenciaTabela: "qualificacoes_idiomas",
          referenciaId: dto.id,
        });
        return { data: dto };
      });
    },
  );

  /* ── Leitura de diplomas/certificados por IA ──────────────────────────── */

  /**
   * Lê um ou mais arquivos (PDF ou imagem) com IA (Gemini — ver
   * lib/ia/leitorDiploma.ts), classifica cada um (formação acadêmica, curso/
   * workshop/certificação, ou idioma) e devolve os campos já prontos pra
   * revisão — NÃO cria nenhum registro aqui. O front mostra uma tela de
   * revisão editável e só chama os POSTs de criação já existentes acima
   * (/qualificacoes/formacoes, /cursos, /idiomas) quando o RH confirmar
   * cada um, com o usuário certo escolhido entre os candidatos sugeridos.
   *
   * Aceita vários arquivos no mesmo multipart (um lote pode ter diplomas de
   * várias pessoas, ou só um). Um arquivo que falhe (formato inválido,
   * ilegível, erro da IA) não derruba os outros — vem com status "erro" e
   * uma mensagem, pro front mostrar e deixar reenviar só aquele.
   */
  app.post<{ Reply: ApiResponse<ResultadoLeituraDiploma[]> | { message: string } }>(
    "/qualificacoes/ler-diplomas",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Cursos e Qualificações"],
        summary: "Lê diplomas/certificados (PDF ou imagem) com IA pra revisão (RH/Admin)",
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      if (!leitorDiplomaConfigurado()) {
        return reply.code(503).send({
          message: "Leitura de diplomas por IA não configurada (defina GEMINI_API_KEY no .env).",
        });
      }

      return rodaComoUsuario(request.user, async () => {
        const resultados: ResultadoLeituraDiploma[] = [];

        for await (const part of request.parts()) {
          if (part.type !== "file") continue;

          const nomeArquivo = part.filename;
          const buffer = await part.toBuffer();

          try {
            const extraido = await lerDocumentoQualificacao(buffer, part.mimetype);

            if (extraido.tipo === "NAO_IDENTIFICADO") {
              resultados.push({
                nomeArquivo,
                status: "nao_identificado",
                nomeDetectado: extraido.nomeDetectado,
                motivo: extraido.motivo,
              });
              continue;
            }

            // Guarda o arquivo já agora — se o RH confirmar na revisão, o
            // POST de criação recebe essa mesma chave em anexoUrl/
            // certificadoUrl, sem precisar de um 2º upload depois.
            const extensao =
              extname(nomeArquivo) || (part.mimetype === "application/pdf" ? ".pdf" : ".jpg");
            const chave = `qualificacoes/ia/${randomUUID()}${extensao}`;
            await uploadObject(chave, buffer, part.mimetype);

            const candidatosUsuario = extraido.nomeDetectado
              ? await buscarUsuariosPorNomeAproximado(extraido.nomeDetectado)
              : [];

            if (extraido.tipo === "FORMACAO_ACADEMICA") {
              resultados.push({
                nomeArquivo,
                status: "pronto_para_revisao",
                tipo: extraido.tipo,
                nomeDetectado: extraido.nomeDetectado,
                dados: { ...extraido.dados, anexoUrl: chave },
                candidatosUsuario,
              });
            } else if (extraido.tipo === "CURSO") {
              resultados.push({
                nomeArquivo,
                status: "pronto_para_revisao",
                tipo: extraido.tipo,
                nomeDetectado: extraido.nomeDetectado,
                dados: { ...extraido.dados, certificadoUrl: chave },
                candidatosUsuario,
              });
            } else {
              resultados.push({
                nomeArquivo,
                status: "pronto_para_revisao",
                tipo: extraido.tipo,
                nomeDetectado: extraido.nomeDetectado,
                dados: extraido.dados,
                candidatosUsuario,
              });
            }
          } catch (error) {
            if (error instanceof FormatoNaoSuportadoError || error instanceof LeituraIAError) {
              resultados.push({ nomeArquivo, status: "erro", motivo: error.message });
              continue;
            }
            if (error instanceof GeminiNaoConfiguradoError) {
              // Já checamos antes do loop — só por segurança, não deveria
              // acontecer no meio de um lote.
              return reply.code(503).send({ message: error.message });
            }
            throw error;
          }
        }

        return { data: resultados };
      });
    },
  );
}
