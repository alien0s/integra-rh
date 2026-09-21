import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { bloquearColaborador } from "../plugins/auth.js";
import {
  atribuirGerente,
  atualizarUsuario,
  excluirUsuario,
  getUsuarioAvatarKey,
  getUsuarioPorId,
  listFuncoes,
  listSetores,
  listUsuarios,
  type AtualizarUsuarioInput,
  type OpcaoSelecao,
  type UsuarioDetalhado,
} from "../lib/usuarios.js";
import { getObjectStream } from "../lib/storage.js";
import { listAtividadesUsuario, type AtividadeUsuarioDTO } from "../lib/notificacoes.js";
import {
  importarUsuarios,
  parsePlanilhaUsuarios,
  type ResultadoImportacao,
} from "../lib/importUsuarios.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/**
 * Rotas de usuários — leem da tabela `users` com os JOINs de
 * setor, função e gestor. Protegidas por JWT (em dev, o
 * decorator `authenticate` libera quando AUTH_ENABLED=false).
 *
 * COLABORADOR só vê os próprios dados — todo o CRUD de usuários (listar,
 * ver perfil de outro, editar, excluir, importar planilha, atribuir gerente)
 * é bloqueado pra esse papel via `bloquearColaborador` (403). Isso espelha o
 * bloqueio no front (sidebar não mostra "Usuários" + guarda de rota em
 * /usuarios), mas o de verdade é este aqui — o front é só UX.
 */
/**
 * Bloqueia COLABORADOR de ver o perfil de QUALQUER OUTRA pessoa — mas libera
 * o próprio (usuarioId === request.user.id). Necessário porque o próprio
 * "Meu perfil" (NavUser) e o hook do usuário logado (avatar/nome na sidebar)
 * usam esta mesma rota — um bloqueio geral quebraria isso pra todo mundo.
 */
async function bloquearColaboradorForaDoProprioPerfil(
  request: FastifyRequest<{ Params: { usuarioId: string } }>,
  reply: FastifyReply,
) {
  if (
    request.user.papelCodigo === "COLABORADOR" &&
    request.params.usuarioId !== request.user.id
  ) {
    await reply
      .code(403)
      .send({ message: "Sem permissão para acessar este recurso." });
  }
}

export async function usuariosRoutes(app: FastifyInstance) {
  /**
   * GET /usuarios
   * Lista todos os usuários cadastrados.
   */
  app.get<{ Reply: ApiListResponse<UsuarioDetalhado> }>(
    "/usuarios",
    {
      onRequest: [app.authenticate, bloquearColaborador],
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
      onRequest: [app.authenticate, bloquearColaboradorForaDoProprioPerfil],
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
   * GET /usuarios/:usuarioId/atividades
   * Atividades recentes do usuário: ações que ele realizou no sistema (não
   * notificações que recebeu) — ver `listAtividadesUsuario`. Mesma
   * permissão do perfil: COLABORADOR só vê a própria.
   */
  app.get<{
    Params: { usuarioId: string };
    Reply: ApiListResponse<AtividadeUsuarioDTO>;
  }>(
    "/usuarios/:usuarioId/atividades",
    {
      onRequest: [app.authenticate, bloquearColaboradorForaDoProprioPerfil],
      schema: { tags: ["Usuários"], summary: "Lista as atividades recentes do usuário" },
    },
    async (request) => {
      const atividades = await listAtividadesUsuario(request.params.usuarioId);
      return { data: atividades, total: atividades.length };
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
   * Atualiza os campos editáveis (cpf, telefone, setor, função).
   */
  app.patch<{
    Params: { usuarioId: string };
    Body: AtualizarUsuarioInput;
    Reply: ApiResponse<UsuarioDetalhado> | { message: string };
  }>(
    "/usuarios/:usuarioId",
    {
      onRequest: [app.authenticate, bloquearColaborador],
      schema: {
        tags: ["Usuários"],
        summary: "Atualiza cpf, telefone, setor, função, papel ou tipo de vínculo",
        body: {
          type: "object",
          properties: {
            cpf: { type: ["string", "null"] },
            telefone: { type: ["string", "null"] },
            setorId: { type: ["string", "null"] },
            entidadeId: { type: ["string", "null"] },
            funcaoId: { type: ["string", "null"] },
            roleCodigo: { type: ["string", "null"] },
            tipoFuncionario: {
              type: "string",
              enum: ["COLABORADOR", "APRENDIZ/ESTAGIÁRIO"],
            },
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
      onRequest: [app.authenticate, bloquearColaborador],
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
    { onRequest: [app.authenticate, bloquearColaborador] },
    async (request, reply) => {
      const excluido = await excluirUsuario(request.params.usuarioId);
      if (!excluido) {
        return reply.code(404).send({ message: "Usuário não encontrado" });
      }
      return reply.code(200).send({ message: "Usuário excluído" });
    },
  );

  /**
   * POST /usuarios/gerentes — atribui alguém como gerente (papel GESTOR) de
   * um setor pelo e-mail. Cria o usuário (só com email + setor + papel) se
   * ainda não existir; os demais dados vêm do APS no 1º login dessa pessoa.
   * Existe para não depender só da função do legado (nem sempre confiável).
   */
  app.post<{
    Body: { email: string; setorId: string };
    Reply: ApiResponse<UsuarioDetalhado> | { message: string };
  }>(
    "/usuarios/gerentes",
    {
      onRequest: [app.authenticate, bloquearColaborador],
      schema: {
        tags: ["Usuários"],
        summary: "Atribui um gerente (papel GESTOR) a um setor",
        body: {
          type: "object",
          required: ["email", "setorId"],
          properties: {
            email: { type: "string", format: "email" },
            setorId: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      if (!email.endsWith("@adventistas.org")) {
        return reply
          .code(400)
          .send({ message: "Use um e-mail corporativo (@adventistas.org)." });
      }

      try {
        const usuario = await atribuirGerente({
          email,
          setorId: request.body.setorId,
          criadoPorUserId: request.user.id,
        });
        return { data: usuario };
      } catch (error) {
        if ((error as { code?: string }).code === "23503") {
          return reply.code(404).send({ message: "Setor não encontrado." });
        }
        throw error;
      }
    },
  );

  /**
   * GET /setores — opções para o dropdown de edição.
   */
  app.get<{ Reply: ApiListResponse<OpcaoSelecao> }>(
    "/setores",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Usuários"],
        summary: "Opções de setor para o formulário de usuário",
      },
    },
    async () => {
      const setores = await listSetores();
      return { data: setores, total: setores.length };
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
