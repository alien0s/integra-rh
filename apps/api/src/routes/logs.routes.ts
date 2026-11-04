import type { FastifyInstance } from "fastify";

import {
  listLogsErros,
  registrarErroCliente,
  type ErroClienteInput,
  type LogErro,
} from "../lib/logs.js";
import { exigirPapeis } from "../plugins/auth.js";
import type { ApiListResponse } from "../types/api.js";

const LIMITE_MAXIMO = 200;

/**
 * Log de erros — leitura (ADMIN, ferramenta de diagnóstico interna) e
 * reporte de erros de front-end (qualquer usuário autenticado — ver
 * lib/logs.ts e o app.setErrorHandler em app.ts, que grava o lado backend).
 */
export async function logsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { limit?: string }; Reply: ApiListResponse<LogErro> }>(
    "/logs",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: {
        tags: ["Logs"],
        summary: "Lista os últimos logs de erros inesperados do backend (ADMIN)",
      },
    },
    async (request) => {
      const limite = Math.min(Number(request.query.limit) || 100, LIMITE_MAXIMO);
      const data = await listLogsErros(limite);
      return { data, total: data.length };
    },
  );

  app.post<{ Body: ErroClienteInput; Reply: { message: string } }>(
    "/logs/cliente",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Logs"],
        summary: "Reporta um erro que aconteceu só no navegador (nunca virou requisição)",
        body: {
          type: "object",
          required: ["modulo", "rota", "mensagem"],
          properties: {
            modulo: { type: "string", minLength: 1 },
            rota: { type: "string", minLength: 1 },
            codigo: { type: "string" },
            mensagem: { type: "string", minLength: 1 },
            stack: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      await registrarErroCliente(request.body, request.user);
      return { message: "Registrado" };
    },
  );
}
