import type { FastifyInstance } from "fastify";

import {
  atualizarEntidade,
  atualizarFuncao,
  atualizarPapel,
  atualizarSetor,
  criarEntidade,
  criarFuncao,
  criarPapel,
  criarSetor,
  excluirEntidade,
  excluirFuncao,
  excluirPapel,
  excluirSetor,
  GRUPOS_ENTIDADE,
  listEntidades,
  listFuncoesCompleto,
  listPapeis,
  listSetoresCompleto,
  type Entidade,
  type EntidadeInput,
  type Funcao,
  type FuncaoInput,
  type Papel,
  type PapelInput,
  type Setor,
  type SetorInput,
} from "../lib/tabelas.js";
import { bloquearColaborador, exigirPapeis } from "../plugins/auth.js";
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
 * apoio do ERP (entidades, setores, funções e papéis). Protegidas por JWT
 * (em dev, o decorator `authenticate` libera quando AUTH_ENABLED=false).
 * Escrita (criar/atualizar/excluir) restrita a ADMIN (nível 7) —
 * `exigirPapeis()` sem argumentos só inclui "ADMIN" no conjunto permitido
 * (ver plugins/auth.ts). Leitura (listar) usa `bloquearColaborador` — essas
 * listas alimentam dropdowns fora da tela "Tabelas" (ex.: editar usuário,
 * usado por RH/DP/Coordenador DP), então só o COLABORADOR fica de fora.
 */
export async function tabelasRoutes(app: FastifyInstance) {
  /* ── Entidades ──────────────────────────────────────────────────────── */

  app.get<{ Reply: ApiListResponse<Entidade> }>(
    "/tabelas/entidades",
    {
      onRequest: [app.authenticate, bloquearColaborador],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
      onRequest: [app.authenticate, exigirPapeis()],
      schema: { tags: ["Tabelas — Entidades"], summary: "Exclui uma entidade (cascata: funções e usuários)" },
    },
    async (request, reply) => {
      // Sem try/catch de FK: entities cascade (ON DELETE CASCADE) para
      // functions/users — a exclusão nunca falha por FK, mas apaga em
      // cascata todos os vínculos da entidade (o front confirma essa
      // consequência antes de chamar esta rota). `setor` é independente de
      // entidade, não é afetado.
      const excluida = await excluirEntidade(request.params.id);
      if (!excluida) {
        return reply.code(404).send({ message: "Entidade não encontrada" });
      }
      return reply.code(204).send(undefined);
    },
  );

  /* ── Setores ────────────────────────────────────────────────────────── */

  app.get<{ Reply: ApiListResponse<Setor> }>(
    "/tabelas/setores",
    {
      onRequest: [app.authenticate, bloquearColaborador],
      schema: { tags: ["Tabelas — Setores"], summary: "Lista todos os setores" },
    },
    async () => {
      const setores = await listSetoresCompleto();
      return { data: setores, total: setores.length };
    },
  );

  app.post<{
    Body: SetorInput;
    Reply: ApiResponse<Setor> | { message: string };
  }>(
    "/tabelas/setores",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: {
        tags: ["Tabelas — Setores"],
        summary: "Cria um setor",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const setor = await criarSetor(request.body);
        return reply.code(201).send({ data: setor });
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe um setor com esse nome.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: SetorInput;
    Reply: ApiResponse<Setor> | { message: string };
  }>(
    "/tabelas/setores/:id",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: {
        tags: ["Tabelas — Setores"],
        summary: "Atualiza um setor",
        body: {
          type: "object",
          required: ["nome"],
          properties: {
            nome: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const setor = await atualizarSetor(request.params.id, request.body);
        if (!setor) {
          return reply.code(404).send({ message: "Setor não encontrado" });
        }
        return { data: setor };
      } catch (error) {
        const tratado = tratarErroPg(error, {
          unique: "Já existe um setor com esse nome.",
        });
        if (tratado) return reply.code(tratado.status).send({ message: tratado.message });
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/tabelas/setores/:id",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: { tags: ["Tabelas — Setores"], summary: "Exclui um setor" },
    },
    async (request, reply) => {
      try {
        const excluido = await excluirSetor(request.params.id);
        if (!excluido) {
          return reply.code(404).send({ message: "Setor não encontrado" });
        }
        return reply.code(204).send(undefined);
      } catch (error) {
        const tratado = tratarErroPg(error, {
          fk: "Não é possível excluir: há usuários vinculados a este setor.",
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
      onRequest: [app.authenticate, bloquearColaborador],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
      onRequest: [app.authenticate, bloquearColaborador],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
      onRequest: [app.authenticate, exigirPapeis()],
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
