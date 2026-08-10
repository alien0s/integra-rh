import type { FastifyInstance } from "fastify";

import {
  atualizarUsuario,
  excluirUsuario,
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
import {
  importarUsuarios,
  parsePlanilhaUsuarios,
  type ResultadoImportacao,
} from "../lib/importUsuarios.js";
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
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Usuários"], summary: "Lista todos os usuários" },
    },
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
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Usuários"], summary: "Busca um usuário pelo id" },
    },
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
    {
      schema: {
        tags: ["Usuários"],
        summary: "Stream da foto do usuário (pública, sem auth)",
        security: [],
      },
    },
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
        tags: ["Usuários"],
        summary: "Atualiza cpf, telefone, departamento, função ou papel",
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
   * POST /usuarios/importar — importa usuários de uma planilha (CSV/Excel).
   * Aceita multipart com um arquivo (`file`) OU um campo `url` (o servidor
   * baixa a planilha). Lê e-mail, nome e entidade; cria os que ainda não
   * existem e devolve um resumo.
   */
  app.post<{ Reply: ApiResponse<ResultadoImportacao> | { message: string } }>(
    "/usuarios/importar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Usuários"],
        summary: "Importa usuários de CSV/Excel (arquivo ou URL)",
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      let buffer: Buffer | null = null;
      let url = "";

      // Lê as partes: arquivo (file) e/ou campo de texto (url).
      for await (const part of request.parts()) {
        if (part.type === "file") {
          buffer = await part.toBuffer();
        } else if (part.fieldname === "url" && typeof part.value === "string") {
          url = part.value.trim();
        }
      }

      // Sem arquivo, mas com URL: o servidor baixa (só http/https — evita SSRF
      // para outros esquemas como file://).
      if (!buffer && url) {
        let protocolo = "";
        try {
          protocolo = new URL(url).protocol;
        } catch {
          return reply.code(400).send({ message: "URL inválida." });
        }
        if (protocolo !== "http:" && protocolo !== "https:") {
          return reply.code(400).send({ message: "A URL deve ser http(s)." });
        }
        try {
          const resposta = await fetch(url);
          if (!resposta.ok) {
            return reply.code(400).send({
              message: `Não foi possível baixar a planilha (HTTP ${resposta.status}).`,
            });
          }
          buffer = Buffer.from(await resposta.arrayBuffer());
        } catch {
          return reply
            .code(400)
            .send({ message: "Falha ao baixar a planilha da URL." });
        }
      }

      if (!buffer || buffer.length === 0) {
        return reply
          .code(400)
          .send({ message: "Envie um arquivo (CSV/Excel) ou uma URL." });
      }

      let linhas;
      try {
        linhas = parsePlanilhaUsuarios(buffer);
      } catch {
        return reply.code(400).send({
          message: "Não foi possível ler a planilha. Verifique o formato (CSV/Excel).",
        });
      }

      if (linhas.length === 0) {
        return reply
          .code(400)
          .send({ message: "A planilha está vazia ou sem linhas de dados." });
      }

      const resultado = await importarUsuarios(linhas);
      return { data: resultado };
    },
  );

  /**
   * DELETE /usuarios/:usuarioId — exclui um usuário.
   */
  app.delete<{
    Params: { usuarioId: string };
    Reply: { message: string };
  }>(
    "/usuarios/:usuarioId",
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const excluido = await excluirUsuario(request.params.usuarioId);
      if (!excluido) {
        return reply.code(404).send({ message: "Usuário não encontrado" });
      }
      return reply.code(200).send({ message: "Usuário excluído" });
    },
  );

  /**
   * GET /departamentos — opções para o dropdown de edição.
   */
  app.get<{ Reply: ApiListResponse<OpcaoSelecao> }>(
    "/departamentos",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Usuários"],
        summary: "Opções de departamento para o formulário de usuário",
      },
    },
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
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Usuários"],
        summary: "Opções de função para o formulário de usuário",
      },
    },
    async () => {
      const funcoes = await listFuncoes();
      return { data: funcoes, total: funcoes.length };
    },
  );
}
