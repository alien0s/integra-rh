import type { FastifyInstance } from "fastify";

import {
  contarNaoLidas,
  listNotificacoes,
  marcarLida,
  marcarTodasLidas,
  type NotificacaoDTO,
} from "../lib/notificacoes.js";
import type { ApiListResponse } from "../types/api.js";

/**
 * Rotas de Notificações do usuário logado (inbox). O destinatário é sempre o
 * próprio `request.user` — ninguém lê a caixa de outro.
 */
export async function notificacoesRoutes(app: FastifyInstance) {
  // Feed do usuário logado (+ contagem de não-lidas para o badge).
  app.get<{
    Reply: ApiListResponse<NotificacaoDTO> & { naoLidas: number };
  }>(
    "/notificacoes",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Notificações"], summary: "Lista as notificações do usuário" },
    },
    async (request) => {
      const notificacoes = await listNotificacoes(request.user.id);
      const naoLidas = await contarNaoLidas(request.user.id);
      return { data: notificacoes, total: notificacoes.length, naoLidas };
    },
  );

  // Marca UMA como lida.
  app.patch<{ Params: { id: string }; Reply: { message: string } }>(
    "/notificacoes/:id/lida",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Notificações"], summary: "Marca uma notificação como lida" },
    },
    async (request, reply) => {
      const ok = await marcarLida(request.params.id, request.user.id);
      if (!ok) {
        return reply.code(404).send({ message: "Notificação não encontrada" });
      }
      return { message: "Marcada como lida" };
    },
  );

  // Marca TODAS como lidas.
  app.post<{ Reply: { message: string; atualizadas: number } }>(
    "/notificacoes/marcar-todas-lidas",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Notificações"], summary: "Marca todas como lidas" },
    },
    async (request) => {
      const atualizadas = await marcarTodasLidas(request.user.id);
      return { message: "Notificações marcadas como lidas", atualizadas };
    },
  );
}
