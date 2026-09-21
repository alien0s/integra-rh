import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type { FastifyInstance } from "fastify";

import {
  anexarArquivoComunicado,
  aprovarComunicado,
  buscarComunicadoPorId,
  criarComunicado,
  listarComunicadosAtivos,
  listarComunicadosAgendados,
  listarComunicadosPendentes,
  rejeitarComunicado,
  removerComunicado,
} from "../lib/comunicacao.js";
import { emitirParaPapeis, emitirParaUsuario } from "../lib/notificacoes.js";
import { getObjectStream, uploadObject } from "../lib/storage.js";
import { bloquearColaborador, exigirPapeis } from "../plugins/auth.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";
import type { Comunicado, CriarComunicadoInput } from "../types/comunicacao.js";

const TIPOS_PERMITIDOS: Record<string, "IMAGEM" | "PDF"> = {
  "image/jpeg": "IMAGEM",
  "image/png": "IMAGEM",
  "image/webp": "IMAGEM",
  "application/pdf": "PDF",
};

/**
 * Rotas do módulo de Comunicação. Fluxo:
 *   RH cria → publica direto (sem notificação de aprovação).
 *   Coordenador+ cria → notifica o RH (acionável) → RH aprova (publica e
 *     avisa o criador) ou rejeita (avisa o criador com o motivo).
 *   Colaborador não pode criar (bloqueado pelo middleware).
 */
export async function comunicacaoRoutes(app: FastifyInstance) {
  /* ── Leitura ─────────────────────────────────────────────────────────── */

  // Mural: qualquer usuário autenticado vê os comunicados ativos no momento.
  app.get<{ Reply: ApiListResponse<Comunicado> }>(
    "/comunicados/ativos",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Comunicação"], summary: "Lista os comunicados ativos (mural)" },
    },
    async () => {
      const comunicados = await listarComunicadosAtivos();
      return { data: comunicados, total: comunicados.length };
    },
  );

  // Fila de aprovação do RH: comunicados aguardando decisão.
  app.get<{ Reply: ApiListResponse<Comunicado> }>(
    "/comunicados/pendentes",
    {
      onRequest: [app.authenticate, exigirPapeis("RH")],
      schema: { tags: ["Comunicação"], summary: "Lista os comunicados aguardando aprovação (RH)" },
    },
    async () => {
      const comunicados = await listarComunicadosPendentes();
      return { data: comunicados, total: comunicados.length };
    },
  );

  // Agendados: já aprovados/publicados, mas ainda não chegou a data_inicio.
  app.get<{ Reply: ApiListResponse<Comunicado> }>(
    "/comunicados/agendados",
    {
      onRequest: [app.authenticate, exigirPapeis("RH")],
      schema: { tags: ["Comunicação"], summary: "Lista os comunicados agendados pro futuro (RH)" },
    },
    async () => {
      const comunicados = await listarComunicadosAgendados();
      return { data: comunicados, total: comunicados.length };
    },
  );

  /* ── Escrita ─────────────────────────────────────────────────────────── */

  // Criar comunicado. Colaborador é bloqueado pelo próprio middleware.
  app.post<{
    Body: CriarComunicadoInput;
    Reply: ApiResponse<Comunicado> | { message: string };
  }>(
    "/comunicados",
    {
      onRequest: [app.authenticate, bloquearColaborador],
      schema: {
        tags: ["Comunicação"],
        summary: "Cria um comunicado (RH publica direto; demais aguardam aprovação do RH)",
        body: {
          type: "object",
          required: ["titulo", "descricao"],
          properties: {
            titulo: { type: "string", minLength: 1 },
            descricao: { type: "string", minLength: 1 },
            dataInicio: { type: "string" }, // YYYY-MM-DD — obrigatório se recorrente=false
            dataFim: { type: "string" },
            recorrente: { type: "boolean" },
            diaSemana: { type: "number", minimum: 0, maximum: 6 },
            anexoUrl: { type: "string" },
            anexoTipo: { type: "string", enum: ["IMAGEM", "PDF"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      let comunicado: Comunicado;
      try {
        comunicado = await criarComunicado(
          request.body,
          request.user.id,
          request.user.papelCodigo!,
        );
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }

      if (comunicado.status === "AGUARDANDO_APROVACAO") {
        try {
          await emitirParaPapeis(["RH"], {
            atorId: request.user.id,
            tipo: "COMUNICADO_AGUARDA_APROVACAO",
            acao: "solicitou a publicação de um comunicado",
            detalhe: comunicado.titulo,
            referenciaTabela: "comunicados",
            requerAcao: true,
          });
        } catch (error) {
          request.log.warn({ error }, "Falha ao notificar RH sobre novo comunicado");
        }
      }

      return reply.code(201).send({ data: comunicado });
    },
  );

  // RH aprova (AGUARDANDO_APROVACAO → PUBLICADO).
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<Comunicado> | { message: string };
  }>(
    "/comunicados/:id/aprovar",
    {
      onRequest: [app.authenticate, exigirPapeis("RH")],
      schema: { tags: ["Comunicação"], summary: "RH aprova e publica o comunicado" },
    },
    async (request, reply) => {
      let comunicado: Comunicado;
      try {
        comunicado = await aprovarComunicado(
          Number(request.params.id),
          request.user.id,
          request.user.papelCodigo!,
        );
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }

      try {
        await emitirParaUsuario(comunicado.criadoPor, {
          atorId: request.user.id,
          tipo: "COMUNICADO_APROVADO",
          acao: "aprovou e publicou seu comunicado",
          detalhe: comunicado.titulo,
          referenciaTabela: "comunicados",
        });
      } catch (error) {
        request.log.warn({ error }, "Falha ao notificar aprovação de comunicado");
      }

      return { data: comunicado };
    },
  );

  // RH rejeita (AGUARDANDO_APROVACAO → REJEITADO), com motivo obrigatório.
  app.patch<{
    Params: { id: string };
    Body: { motivoRejeicao: string };
    Reply: ApiResponse<Comunicado> | { message: string };
  }>(
    "/comunicados/:id/rejeitar",
    {
      onRequest: [app.authenticate, exigirPapeis("RH")],
      schema: {
        tags: ["Comunicação"],
        summary: "RH rejeita o comunicado (com justificativa)",
        body: {
          type: "object",
          required: ["motivoRejeicao"],
          properties: { motivoRejeicao: { type: "string", minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      let comunicado: Comunicado;
      try {
        comunicado = await rejeitarComunicado(
          Number(request.params.id),
          request.body.motivoRejeicao,
          request.user.id,
          request.user.papelCodigo!,
        );
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }

      try {
        await emitirParaUsuario(comunicado.criadoPor, {
          atorId: request.user.id,
          tipo: "COMUNICADO_REJEITADO",
          acao: "rejeitou seu comunicado",
          detalhe: comunicado.motivoRejeicao ?? undefined,
          referenciaTabela: "comunicados",
        });
      } catch (error) {
        request.log.warn({ error }, "Falha ao notificar rejeição de comunicado");
      }

      return { data: comunicado };
    },
  );

  // RH remove um comunicado que já está no ar.
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<Comunicado> | { message: string };
  }>(
    "/comunicados/:id/remover",
    {
      onRequest: [app.authenticate, exigirPapeis("RH")],
      schema: { tags: ["Comunicação"], summary: "RH remove o comunicado do ar" },
    },
    async (request, reply) => {
      let comunicado: Comunicado;
      try {
        comunicado = await removerComunicado(
          Number(request.params.id),
          request.user.id,
          request.user.papelCodigo!,
        );
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }

      return { data: comunicado };
    },
  );

  // Envia (ou troca) o anexo de um comunicado. Só o criador ou o RH.
  app.post<{ Params: { id: string } }>(
    "/comunicados/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Comunicação"],
        summary: "Envia (ou troca) o anexo do comunicado (imagem ou PDF)",
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ message: "Nenhum arquivo enviado" });
      }

      const anexoTipo = TIPOS_PERMITIDOS[file.mimetype];
      if (!anexoTipo) {
        return reply
          .code(415)
          .send({ message: "Formato inválido. Use JPEG, PNG, WebP ou PDF." });
      }

      const comunicadoId = Number(request.params.id);
      const buffer = await file.toBuffer();
      const extensao = extname(file.filename) || "";
      const key = `comunicados/${comunicadoId}/${randomUUID()}${extensao}`;

      try {
        await uploadObject(key, buffer, file.mimetype);
        const comunicado = await anexarArquivoComunicado(
          comunicadoId,
          request.user.id,
          request.user.papelCodigo!,
          key,
          anexoTipo,
        );
        return reply.send({ data: comunicado });
      } catch (error) {
        return reply.code(400).send({ message: (error as Error).message });
      }
    },
  );

  // Baixa o anexo do comunicado (a API repassa o arquivo, o front nunca acessa o MinIO direto).
  app.get<{ Params: { id: string } }>(
    "/comunicados/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Comunicação"], summary: "Baixa o anexo do comunicado" },
    },
    async (request, reply) => {
      const comunicado = await buscarComunicadoPorId(Number(request.params.id));
      if (!comunicado || !comunicado.anexoUrl) {
        return reply.code(404).send({ message: "Anexo não encontrado" });
      }

      const { body, contentType } = await getObjectStream(comunicado.anexoUrl);
      reply.header("Content-Type", contentType);
      return reply.send(body);
    },
  );
}