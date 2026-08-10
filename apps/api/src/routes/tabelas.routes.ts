import type { FastifyInstance } from "fastify";

import {
  atualizarDepartamento,
  atualizarEntidade,
  atualizarFuncao,
  atualizarPapel,
  criarDepartamento,
  criarEntidade,
  criarFuncao,
  criarPapel,
  excluirDepartamento,
  excluirEntidade,
  excluirFuncao,
  excluirPapel,
  GRUPOS_ENTIDADE,
  listDepartamentosCompleto,
  listEntidades,
  listFuncoesCompleto,
  listPapeis,
  type Departamento,
  type DepartamentoInput,
  type Entidade,
  type EntidadeInput,
  type Funcao,
  type FuncaoInput,
  type Papel,
  type PapelInput,
} from "../lib/tabelas.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/** Mapeia códigos de erro do Postgres para uma resposta 409 amigável. */
function tratarErroPg(
  error: unknown,
  mensagens: { unique?: string; fk?: string },
): { status: number; message: string } | null {
  const codigo = (error as { code?: string }).code;

  if (codigo === "23505" && mensagens.unique) {
    return { status: 409, message: mensagens.unique };
  }
  if (codigo === "23503" && mensagens.fk) {
    return { status: 409, message: mensagens.fk };
  }
  return null;
}

/**
 * Rotas da tela "Tabelas" — CRUD administrativo completo das tabelas de
 * apoio do ERP (entidades, departamentos, funções e papéis). Protegidas por
 * JWT, como as demais rotas (em dev, o decorator `authenticate` libera
 * quando AUTH_ENABLED=false).
 */
export async function tabelasRoutes(app: FastifyInstance) {
  /* ── Entidades ──────────────────────────────────────────────────────── */

  app.get<{ Reply: ApiListResponse<Entidade> }>(
    "/tabelas/entidades",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Entidades"], summary: "Lista todas as entidades" },
    },
    async () => {
      const entidades = await listEntidades();
      return { data: entidades, total: entidades.length };
    },
  );

  app.post<{
    Body: EntidadeInput;
    Reply: ApiResponse<Entidade> | { message: string };
  }>(
    "/tabelas/entidades",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Entidades"],
        summary: "Cria uma entidade",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
            cnpj: { type: ["string", "null"] },
            grupo: { type: ["string", "null"], enum: [...GRUPOS_ENTIDADE, null] },
            codigoAps: {
              type: ["integer", "null"],
              minimum: 100000,
              maximum: 999999,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const entidade = await criarEntidade(request.body);
        return reply.code(201).send({ data: entidade });
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe uma entidade com esse CNPJ ou código APS.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: EntidadeInput;
    Reply: ApiResponse<Entidade> | { message: string };
  }>(
    "/tabelas/entidades/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Entidades"],
        summary: "Atualiza uma entidade",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
            cnpj: { type: ["string", "null"] },
            grupo: { type: ["string", "null"], enum: [...GRUPOS_ENTIDADE, null] },
            codigoAps: {
              type: ["integer", "null"],
              minimum: 100000,
              maximum: 999999,
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const entidade = await atualizarEntidade(request.params.id, request.body);
        if (!entidade) {
          return reply.code(404).send({ message: "Entidade não encontrada" });
        }
        return { data: entidade };
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe uma entidade com esse CNPJ ou código APS.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/tabelas/entidades/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Entidades"], summary: "Exclui uma entidade (cascata: departamentos, funções e usuários)" },
    },
    async (request, reply) => {
      // Sem try/catch de FK: entities cascade (ON DELETE CASCADE) para
      // departments/functions/users — a exclusão nunca falha por FK, mas
      // apaga em cascata todos os vínculos da entidade (o front confirma
      // essa consequência antes de chamar esta rota).
      const excluida = await excluirEntidade(request.params.id);
      if (!excluida) {
        return reply.code(404).send({ message: "Entidade não encontrada" });
      }
      return reply.code(204).send(undefined);
    },
  );

  /* ── Departamentos ──────────────────────────────────────────────────── */

  app.get<{ Reply: ApiListResponse<Departamento> }>(
    "/tabelas/departamentos",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Departamentos"], summary: "Lista todos os departamentos" },
    },
    async () => {
      const departamentos = await listDepartamentosCompleto();
      return { data: departamentos, total: departamentos.length };
    },
  );

  app.post<{
    Body: DepartamentoInput;
    Reply: ApiResponse<Departamento> | { message: string };
  }>(
    "/tabelas/departamentos",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Departamentos"],
        summary: "Cria um departamento",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
            descricao: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const departamento = await criarDepartamento(request.body);
        return reply.code(201).send({ data: departamento });
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe um departamento com esse nome.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: DepartamentoInput;
    Reply: ApiResponse<Departamento> | { message: string };
  }>(
    "/tabelas/departamentos/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Departamentos"],
        summary: "Atualiza um departamento",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
            descricao: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const departamento = await atualizarDepartamento(request.params.id, request.body);
        if (!departamento) {
          return reply.code(404).send({ message: "Departamento não encontrado" });
        }
        return { data: departamento };
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe um departamento com esse nome.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/tabelas/departamentos/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Departamentos"], summary: "Exclui um departamento" },
    },
    async (request, reply) => {
      try {
        const excluido = await excluirDepartamento(request.params.id);
        if (!excluido) {
          return reply.code(404).send({ message: "Departamento não encontrado" });
        }
        return reply.code(204).send(undefined);
      } catch (error) {
        const tratado = tratarErroPg(error, {
          fk: "Não é possível excluir: há usuários vinculados a este departamento.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  /* ── Funções ────────────────────────────────────────────────────────── */

  app.get<{ Reply: ApiListResponse<Funcao> }>(
    "/tabelas/funcoes",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Funções"], summary: "Lista todas as funções" },
    },
    async () => {
      const funcoes = await listFuncoesCompleto();
      return { data: funcoes, total: funcoes.length };
    },
  );

  app.post<{
    Body: FuncaoInput;
    Reply: ApiResponse<Funcao> | { message: string };
  }>(
    "/tabelas/funcoes",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Funções"],
        summary: "Cria uma função",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
            descricao: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const funcao = await criarFuncao(request.body);
        return reply.code(201).send({ data: funcao });
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe uma função com esse nome.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: FuncaoInput;
    Reply: ApiResponse<Funcao> | { message: string };
  }>(
    "/tabelas/funcoes/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Funções"],
        summary: "Atualiza uma função",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
            descricao: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const funcao = await atualizarFuncao(request.params.id, request.body);
        if (!funcao) {
          return reply.code(404).send({ message: "Função não encontrada" });
        }
        return { data: funcao };
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe uma função com esse nome.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/tabelas/funcoes/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Funções"], summary: "Exclui uma função" },
    },
    async (request, reply) => {
      try {
        const excluida = await excluirFuncao(request.params.id);
        if (!excluida) {
          return reply.code(404).send({ message: "Função não encontrada" });
        }
        return reply.code(204).send(undefined);
      } catch (error) {
        const tratado = tratarErroPg(error, {
          fk: "Não é possível excluir: há usuários vinculados a esta função.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  /* ── Papéis ─────────────────────────────────────────────────────────── */

  app.get<{ Reply: ApiListResponse<Papel> }>(
    "/tabelas/papeis",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Papéis"], summary: "Lista todos os papéis" },
    },
    async () => {
      const papeis = await listPapeis();
      return { data: papeis, total: papeis.length };
    },
  );

  app.post<{
    Body: PapelInput;
    Reply: ApiResponse<Papel> | { message: string };
  }>(
    "/tabelas/papeis",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Papéis"],
        summary: "Cria um papel",
        body: {
          type: "object",
          required: ["codigo", "nome", "nivel"],
          properties: {
            codigo: { type: "string", minLength: 1 },
            nome: { type: "string", minLength: 1 },
            nivel: { type: "number" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const papel = await criarPapel(request.body);
        return reply.code(201).send({ data: papel });
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe um papel com esse código.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: PapelInput;
    Reply: ApiResponse<Papel> | { message: string };
  }>(
    "/tabelas/papeis/:id",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Tabelas — Papéis"],
        summary: "Atualiza um papel",
        body: {
          type: "object",
          required: ["codigo", "nome", "nivel"],
          properties: {
            codigo: { type: "string", minLength: 1 },
            nome: { type: "string", minLength: 1 },
            nivel: { type: "number" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const papel = await atualizarPapel(request.params.id, request.body);
        if (!papel) {
          return reply.code(404).send({ message: "Papel não encontrado" });
        }
        return { data: papel };
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe um papel com esse código.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/tabelas/papeis/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Tabelas — Papéis"], summary: "Exclui um papel" },
    },
    async (request, reply) => {
      // Sem try/catch de FK: users.role_id é ON DELETE SET NULL — excluir um
      // papel em uso nunca falha, só desvincula os usuários (ficam sem papel).
      const excluido = await excluirPapel(request.params.id);
      if (!excluido) {
        return reply.code(404).send({ message: "Papel não encontrado" });
      }
      return reply.code(204).send(undefined);
    },
  );
}
