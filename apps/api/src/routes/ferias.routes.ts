import type { FastifyInstance } from "fastify";

import {
  aprovarSolicitacao,
  criarSolicitacao,
  getResumoFerias,
  getSolicitacaoParaNotificar,
  listMinhasSolicitacoes,
  listSolicitacoes,
  recusarSolicitacao,
  type CriarSolicitacaoInput,
  type FeriasResumoDTO,
  type MinhaSolicitacaoDTO,
  type SolicitacaoFeriasDTO,
} from "../lib/ferias.js";
import { emitirParaPapeis, emitirParaUsuario } from "../lib/notificacoes.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/**
 * Rotas de Férias/Folga. Toda ação relevante emite notificação:
 *   - criar  → notifica o RH (acionável: Aprovar/Recusar).
 *   - decidir (aprovar/recusar) → notifica o colaborador (informativa).
 */
export async function feriasRoutes(app: FastifyInstance) {
  /* ── Leitura ─────────────────────────────────────────────────────────── */

  // Visão geral (gestor/RH): todas as solicitações.
  app.get<{ Reply: ApiListResponse<SolicitacaoFeriasDTO> }>(
    "/ferias",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Lista todas as solicitações" },
    },
    async () => {
      const solicitacoes = await listSolicitacoes();
      return { data: solicitacoes, total: solicitacoes.length };
    },
  );

  // Aba Pessoal: histórico do próprio colaborador.
  app.get<{ Reply: ApiListResponse<MinhaSolicitacaoDTO> }>(
    "/ferias/minhas",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Histórico do próprio colaborador" },
    },
    async (request) => {
      const minhas = await listMinhasSolicitacoes(request.user.id);
      return { data: minhas, total: minhas.length };
    },
  );

  // Aba Pessoal: resumo do saldo (cards do topo).
  app.get<{ Reply: ApiResponse<FeriasResumoDTO> }>(
    "/ferias/resumo",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Resumo do saldo do colaborador" },
    },
    async (request) => {
      return { data: await getResumoFerias(request.user.id) };
    },
  );

  /* ── Escrita ─────────────────────────────────────────────────────────── */

  // Nova solicitação (o colaborador logado).
  app.post<{
    Body: CriarSolicitacaoInput;
    Reply: ApiResponse<SolicitacaoFeriasDTO>;
  }>(
    "/ferias",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Férias"],
        summary: "Cria uma solicitação de férias/folga",
        body: {
          type: "object",
          required: ["tipo", "dataInicio", "dataFim"],
          properties: {
            tipo: { type: "string", enum: ["FERIAS", "FOLGA"] },
            dataInicio: { type: "string" }, // YYYY-MM-DD
            dataFim: { type: "string" },
            abono: { type: "boolean" },
            observacoes: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const criada = await criarSolicitacao(request.user.id, request.body);

      // Notifica o RH — acionável (aprovar/recusar direto no card).
      const verbo =
        request.body.tipo === "FOLGA" ? "solicitou folga" : "solicitou férias";
      await emitirParaPapeis(["RH"], {
        atorId: request.user.id,
        tipo: `${request.body.tipo}_SOLICITADA`,
        acao: verbo,
        detalhe: criada.periodo,
        referenciaTabela: "ferias_solicitacoes",
        referenciaId: criada.id,
        requerAcao: true,
      });

      return { data: criada };
    },
  );

  // Aprovar (gestor/RH).
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/aprovar",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Aprova uma solicitação" },
    },
    async (request, reply) => {
      const dto = await aprovarSolicitacao(request.params.id, request.user.id);
      if (!dto) {
        return reply
          .code(404)
          .send({ message: "Solicitação não encontrada ou já decidida." });
      }

      // Notifica o colaborador que pediu.
      const info = await getSolicitacaoParaNotificar(request.params.id);
      if (info) {
        await emitirParaUsuario(info.userId, {
          atorId: request.user.id,
          tipo: "FERIAS_APROVADA",
          acao: "aprovou sua solicitação de férias",
          detalhe: info.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: request.params.id,
        });
      }

      return { data: dto };
    },
  );

  // Recusar (gestor/RH) com justificativa.
  app.patch<{
    Params: { id: string };
    Body: { motivo: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/recusar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Férias"],
        summary: "Recusa uma solicitação (com justificativa)",
        body: {
          type: "object",
          required: ["motivo"],
          properties: { motivo: { type: "string", minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const dto = await recusarSolicitacao(
        request.params.id,
        request.user.id,
        request.body.motivo,
      );
      if (!dto) {
        return reply
          .code(404)
          .send({ message: "Solicitação não encontrada ou já decidida." });
      }

      const info = await getSolicitacaoParaNotificar(request.params.id);
      if (info) {
        await emitirParaUsuario(info.userId, {
          atorId: request.user.id,
          tipo: "FERIAS_RECUSADA",
          acao: "recusou sua solicitação de férias",
          detalhe: request.body.motivo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: request.params.id,
        });
      }

      return { data: dto };
    },
  );
}
