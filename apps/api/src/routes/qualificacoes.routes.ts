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
import { emitirParaPapeis } from "../lib/notificacoes.js";
import { deleteObject, getObjectStream, uploadObject } from "../lib/storage.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/** Mimetypes aceitos pra diploma/certificado — imagem (foto do documento) ou PDF. */
const TIPOS_ANEXO_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/** Papéis com permissão para moderar (aprovar/recusar/excluir de qualquer pessoa). */
const PAPEIS_RH = new Set(["ADMIN", "RH"]);

/**
 * Papel que recebe a notificação de "novo cadastro pendente" (fila de
 * moderação). Hoje é o DP (Departamento Pessoal) — distinto do papel "RH"
 * usado nas checagens de permissão acima (a empresa trata os dois como
 * papéis diferentes; a moderação de qualificações ainda não tem uma tela
 * dedicada, então por enquanto a notificação é só informativa).
 */
const PAPEIS_NOTIFICAR_NOVA_QUALIFICACAO = ["DP"];

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
      const userId = request.user.id;
      const [formacoes, cursos, idiomas] = await Promise.all([
        listMinhasFormacoes(userId),
        listMeusCursos(userId),
        listMeusIdiomas(userId),
      ]);
      return { data: { formacoes, cursos, idiomas } };
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
      const { usuarioId } = request.params;
      const [formacoes, cursos, idiomas] = await Promise.all([
        listFormacoesAprovadas(usuarioId),
        listCursosAprovados(usuarioId),
        listIdiomasAprovados(usuarioId),
      ]);
      return { data: { formacoes, cursos, idiomas } };
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
      const [formacoes, cursos, idiomas] = await Promise.all([
        listFormacoesPendentes(),
        listCursosPendentes(),
        listIdiomasPendentes(),
      ]);
      return { data: { formacoes, cursos, idiomas } };
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
      });

      return reply.code(201).send({ data: criada });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/formacoes/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Exclui uma formação acadêmica" },
    },
    async (request, reply) => {
      const excluida = await excluirFormacao(
        request.params.id,
        request.user.id,
        ehRh(request.user.papelCodigo),
      );
      if (!excluida) {
        return reply.code(404).send({ message: "Formação não encontrada." });
      }
      return reply.code(204).send(undefined);
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
      const dto = await aprovarFormacao(request.params.id, request.user.id);
      if (!dto) {
        return reply.code(404).send({ message: "Formação não encontrada ou já decidida." });
      }
      return { data: dto };
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
      const dto = await recusarFormacao(request.params.id, request.user.id, request.body.motivo);
      if (!dto) {
        return reply.code(404).send({ message: "Formação não encontrada ou já decidida." });
      }
      return { data: dto };
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
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/formacoes/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Remove o anexo de uma formação acadêmica" },
    },
    async (request, reply) => {
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
      });

      return reply.code(201).send({ data: criado });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/cursos/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Exclui um curso/workshop/certificação" },
    },
    async (request, reply) => {
      const excluido = await excluirCurso(
        request.params.id,
        request.user.id,
        ehRh(request.user.papelCodigo),
      );
      if (!excluido) {
        return reply.code(404).send({ message: "Registro não encontrado." });
      }
      return reply.code(204).send(undefined);
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
      const dto = await aprovarCurso(request.params.id, request.user.id);
      if (!dto) {
        return reply.code(404).send({ message: "Registro não encontrado ou já decidido." });
      }
      return { data: dto };
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
      const dto = await recusarCurso(request.params.id, request.user.id, request.body.motivo);
      if (!dto) {
        return reply.code(404).send({ message: "Registro não encontrado ou já decidido." });
      }
      return { data: dto };
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
      });

      return reply.code(201).send({ data: salvo });
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/qualificacoes/idiomas/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Cursos e Qualificações"], summary: "Exclui um idioma" },
    },
    async (request, reply) => {
      const excluido = await excluirIdioma(
        request.params.id,
        request.user.id,
        ehRh(request.user.papelCodigo),
      );
      if (!excluido) {
        return reply.code(404).send({ message: "Idioma não encontrado." });
      }
      return reply.code(204).send(undefined);
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
      const dto = await aprovarIdioma(request.params.id, request.user.id);
      if (!dto) {
        return reply.code(404).send({ message: "Idioma não encontrado ou já decidido." });
      }
      return { data: dto };
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
      const dto = await recusarIdioma(request.params.id, request.user.id, request.body.motivo);
      if (!dto) {
        return reply.code(404).send({ message: "Idioma não encontrado ou já decidido." });
      }
      return { data: dto };
    },
  );
}
