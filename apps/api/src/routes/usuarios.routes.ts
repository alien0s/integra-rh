import type { FastifyInstance } from "fastify";

import {
  atualizarUsuario,
  getUsuarioAvatarKey,
  getUsuarioPorId,
  listDepartamentos,
  listFuncoes,
  listUsuarios,
  type AtualizarUsuarioInput,
  type OpcaoSelecao,
  type UsuarioDetalhado,
} from "../lib/database.js";
import { getObjectStream } from "../lib/storage.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/**
 * Rotas de usuários — leem da tabela `users` com os JOINs de
 * departamento, função e gestor. Protegidas por JWT (em dev, o
 * decorator `authenticate` libera quando AUTH_ENABLED=false).
 */
export async function usuariosRoutes(app: FastifyInstance) {
  /**
   * GET /usuarios
   * Lista todos os usuários cadastrados.
   */
  app.get<{ Reply: ApiListResponse<UsuarioDetalhado> }>(
    "/usuarios",
    { onRequest: [app.authenticate] },
    async () => {
      const usuarios = await listUsuarios();
      return { data: usuarios, total: usuarios.length };
    },
  );

  /**
   * GET /usuarios/:usuarioId
   * Retorna um usuário específico; 404 se não existir.
   */
  app.get<{
    Params: { usuarioId: string };
    Reply: ApiResponse<UsuarioDetalhado> | { message: string };
  }>(
    "/usuarios/:usuarioId",
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const usuario = await getUsuarioPorId(request.params.usuarioId);

      if (!usuario) {
        return reply.code(404).send({ message: "Usuário não encontrado" });
      }

      return { data: usuario };
    },
  );

  /**
   * GET /usuarios/:usuarioId/avatar
   * Faz stream da foto direto do storage (MinIO), então o navegador nunca
   * acessa o MinIO diretamente. Pública (sem auth) porque a tag <img> não
   * envia o header Authorization.
   */
  app.get<{ Params: { usuarioId: string } }>(
    "/usuarios/:usuarioId/avatar",
    async (request, reply) => {
      const key = await getUsuarioAvatarKey(request.params.usuarioId);

      if (!key) {
        return reply.code(404).send({ message: "Sem avatar" });
      }

      try {
        const { body, contentType } = await getObjectStream(key);
        reply.header("Content-Type", contentType);
        // Cache curto no navegador: evita refetch (e "flash") a cada navegação,
        // já que a sidebar remonta. Após trocar a foto, o front adiciona um
        // ?t=timestamp para furar o cache e exibir a nova na hora.
        reply.header("Cache-Control", "private, max-age=60");
        return reply.send(body);
      } catch {
        return reply.code(404).send({ message: "Avatar indisponível" });
      }
    },
  );

  /**
   * PATCH /usuarios/:usuarioId
   * Atualiza os campos editáveis (cpf, telefone, departamento, função).
   */
  app.patch<{
    Params: { usuarioId: string };
    Body: AtualizarUsuarioInput;
    Reply: ApiResponse<UsuarioDetalhado> | { message: string };
  }>(
    "/usuarios/:usuarioId",
    {
      onRequest: [app.authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            cpf: { type: ["string", "null"] },
            telefone: { type: ["string", "null"] },
            departamentoId: { type: ["string", "null"] },
            funcaoId: { type: ["string", "null"] },
            roleCodigo: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const usuario = await atualizarUsuario(
          request.params.usuarioId,
          request.body,
        );

        if (!usuario) {
          return reply.code(404).send({ message: "Usuário não encontrado" });
        }

        return { data: usuario };
      } catch (error) {
        // CPF duplicado dentro da entidade (unique_cpf_per_entity).
        if ((error as { code?: string }).code === "23505") {
          return reply
            .code(409)
            .send({ message: "CPF já cadastrado para outro usuário." });
        }
        throw error;
      }
    },
  );

  /**
   * GET /departamentos — opções para o dropdown de edição.
   */
  app.get<{ Reply: ApiListResponse<OpcaoSelecao> }>(
    "/departamentos",
    { onRequest: [app.authenticate] },
    async () => {
      const departamentos = await listDepartamentos();
      return { data: departamentos, total: departamentos.length };
    },
  );

  /**
   * GET /funcoes — opções para o dropdown de edição.
   */
  app.get<{ Reply: ApiListResponse<OpcaoSelecao> }>(
    "/funcoes",
    { onRequest: [app.authenticate] },
    async () => {
      const funcoes = await listFuncoes();
      return { data: funcoes, total: funcoes.length };
    },
  );
}
