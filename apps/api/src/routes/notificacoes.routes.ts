import type { FastifyInstance } from "fastify";

import { verifyAuthToken } from "../lib/jwt.js";
import {
  contarNaoLidas,
  listNotificacoes,
  marcarLida,
  marcarTodasLidas,
  type NotificacaoDTO,
} from "../lib/notificacoes.js";
import { registrarCliente } from "../lib/notificacoesStream.js";
import { avaliarObrigacoesRecorrentes } from "../lib/obrigacoes.js";
import { getApiConfig } from "../plugins/env.js";
import type { ApiListResponse } from "../types/api.js";

/**
 * Rotas de Notificações do usuário logado (inbox). O destinatário é sempre o
 * próprio `request.user` — ninguém lê a caixa de outro.
 */
export async function notificacoesRoutes(app: FastifyInstance) {
  // Stream em TEMPO REAL (SSE). O EventSource do browser não manda header
  // Authorization, então o token vem por query. Ao receber um evento, o cliente
  // refaz o GET /notificacoes (e dispara os toasts das novas).
  app.get<{ Querystring: { token?: string } }>(
    "/notificacoes/stream",
    { schema: { tags: ["Notificações"], summary: "Stream de notificações (SSE)" } },
    async (request, reply) => {
      let userId: string;
      if (getApiConfig().authEnabled) {
        const token = request.query.token;
        if (!token) {
          return reply.code(401).send({ message: "Token não fornecido" });
        }
        try {
          userId = verifyAuthToken(token).id;
        } catch {
          return reply.code(401).send({ message: "Token inválido" });
        }
      } else {
        userId = "dev";
      }

      // Assume o controle da resposta (Fastify não gerencia mais este reply).
      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // evita buffering em proxies (nginx)
      });
      reply.raw.write(": conectado\n\n");

      const remover = registrarCliente(userId, {
        write: (chunk) => reply.raw.write(chunk),
      });
      // Ping periódico mantém a conexão viva (proxies fecham conexões ociosas).
      const ping = setInterval(() => {
        try {
          reply.raw.write(": ping\n\n");
        } catch {
          /* ignora */
        }
      }, 25_000);

      request.raw.on("close", () => {
        clearInterval(ping);
        remover();
      });
    },
  );

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
      // Obrigações recorrentes SOB DEMANDA (ver lib/obrigacoes.ts): ao abrir o
      // app (o sino busca o feed), avalia pendências do colaborador (ex.:
      // ainda não solicitou férias) e emite notificações antes de listar.
      // Idempotente (no máximo 1 por dia por obrigação); não derruba a
      // listagem se falhar.
      try {
        await avaliarObrigacoesRecorrentes(request.user.id);
      } catch (error) {
        request.log.warn({ error }, "Falha ao avaliar obrigações recorrentes");
      }

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
