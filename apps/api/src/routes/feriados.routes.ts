import type { FastifyInstance } from "fastify";

import {
  atualizarFeriado,
  criarFeriado,
  excluirFeriado,
  excluirFeriadosPorAno,
  FeriadoInvalidoError,
  importarFeriadosLegado,
  importarFeriadosNacionais,
  listFeriados,
  type AtualizarFeriadoInput,
  type CriarFeriadoInput,
  type FeriadoDTO,
} from "../lib/feriados.js";
import { MssqlIndisponivelError } from "../lib/mssql.js";
import { exigirPapeis } from "../plugins/auth.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

const TIPOS = ["NACIONAL", "ESTADUAL", "MUNICIPAL", "FACULTATIVO"];

/**
 * Rotas de Feriados (mapa que limita o calendário de férias). Leitura liberada
 * a qualquer autenticado (o calendário do colaborador precisa dela); escrita e
 * importação só para o DP/ADMIN.
 */
export async function feriadosRoutes(app: FastifyInstance) {
  // Lista (opcionalmente por ano) — qualquer autenticado.
  app.get<{
    Querystring: { ano?: number };
    Reply: ApiListResponse<FeriadoDTO>;
  }>(
    "/feriados",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Feriados"],
        summary: "Lista feriados (filtro opcional por ano)",
        querystring: {
          type: "object",
          properties: { ano: { type: "integer" } },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const feriados = await listFeriados(request.query.ano);
      return { data: feriados, total: feriados.length };
    },
  );

  // Criar (DP/ADMIN).
  app.post<{
    Body: CriarFeriadoInput;
    Reply: ApiResponse<FeriadoDTO> | { message: string };
  }>(
    "/feriados",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: {
        tags: ["Feriados"],
        summary: "Cadastra um feriado",
        body: {
          type: "object",
          required: ["data", "nome"],
          properties: {
            data: { type: "string" }, // YYYY-MM-DD
            nome: { type: "string", minLength: 1 },
            tipo: { type: "string", enum: TIPOS },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const criado = await criarFeriado(request.body);
        return reply.code(201).send({ data: criado });
      } catch (error) {
        if (error instanceof FeriadoInvalidoError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Atualizar (DP/ADMIN).
  app.patch<{
    Params: { id: string };
    Body: AtualizarFeriadoInput;
    Reply: ApiResponse<FeriadoDTO> | { message: string };
  }>(
    "/feriados/:id",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: {
        tags: ["Feriados"],
        summary: "Atualiza um feriado",
        body: {
          type: "object",
          properties: {
            data: { type: "string" },
            nome: { type: "string", minLength: 1 },
            tipo: { type: "string", enum: TIPOS },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const atualizado = await atualizarFeriado(request.params.id, request.body);
        if (!atualizado) {
          return reply.code(404).send({ message: "Feriado não encontrado." });
        }
        return { data: atualizado };
      } catch (error) {
        if (error instanceof FeriadoInvalidoError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Excluir (DP/ADMIN).
  app.delete<{
    Params: { id: string };
    Reply: { message: string };
  }>(
    "/feriados/:id",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: { tags: ["Feriados"], summary: "Exclui um feriado" },
    },
    async (request, reply) => {
      const removido = await excluirFeriado(request.params.id);
      if (!removido) {
        return reply.code(404).send({ message: "Feriado não encontrado." });
      }
      return { message: "Feriado excluído." };
    },
  );

  // Excluir todos os feriados de um ano (DP/ADMIN) — zera o ano antes de
  // reimportar, por exemplo.
  app.delete<{
    Params: { ano: number };
    Reply: ApiResponse<{ removidos: number }>;
  }>(
    "/feriados/ano/:ano",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: {
        tags: ["Feriados"],
        summary: "Exclui todos os feriados de um ano",
        params: {
          type: "object",
          required: ["ano"],
          properties: { ano: { type: "integer", minimum: 2000, maximum: 2100 } },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const removidos = await excluirFeriadosPorAno(request.params.ano);
      return { data: { removidos } };
    },
  );

  // Importar feriados nacionais de um ano da BrasilAPI (DP/ADMIN).
  app.post<{
    Body: { ano: number };
    Reply: ApiResponse<{ inseridos: number; total: number }> | { message: string };
  }>(
    "/feriados/importar",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: {
        tags: ["Feriados"],
        summary: "Importa os feriados nacionais de um ano (BrasilAPI)",
        body: {
          type: "object",
          required: ["ano"],
          properties: { ano: { type: "integer", minimum: 2000, maximum: 2100 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const resultado = await importarFeriadosNacionais(request.body.ano);
        return { data: resultado };
      } catch (error) {
        if (error instanceof FeriadoInvalidoError) {
          return reply.code(502).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Importar feriados municipais/estaduais de um ano do legado (APS/DP).
  app.post<{
    Body: { ano: number };
    Reply: ApiResponse<{ inseridos: number; total: number }> | { message: string };
  }>(
    "/feriados/importar-legado",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: {
        tags: ["Feriados"],
        summary: "Importa os feriados municipais/estaduais de um ano do legado (APS)",
        body: {
          type: "object",
          required: ["ano"],
          properties: { ano: { type: "integer", minimum: 2000, maximum: 2100 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const resultado = await importarFeriadosLegado(request.body.ano);
        return { data: resultado };
      } catch (error) {
        if (error instanceof MssqlIndisponivelError) {
          return reply.code(503).send({ message: error.message });
        }
        if (error instanceof FeriadoInvalidoError) {
          return reply.code(502).send({ message: error.message });
        }
        throw error;
      }
    },
  );
}
