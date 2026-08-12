import type { FastifyInstance } from "fastify";

import { signAuthToken } from "../lib/jwt.js";
import { authenticateWithLdap, LdapUnavailableError } from "../lib/ldap.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  atualizarPerfilProprio,
  criarUsuarioComSenha,
  definirSenhaUsuario,
  findOrCreateUsuarioLocal,
  getUsuarioAuthPorEmail,
  getUsuarioPorId,
  updateUserAvatar,
  type AppUser,
  type UsuarioDetalhado,
} from "../lib/database.js";
import {
  PAPEIS_QUE_PODEM_PERSONIFICAR,
  type AuthTokenResponse,
  type AuthUser,
  type CheckEmailBody,
  type CheckEmailResponse,
  type LoginRequestBody,
  type SetPasswordBody,
  type UpdateMeuPerfilBody,
} from "../types/auth.js";
import type { ApiResponse } from "../types/api.js";

/** Domínio corporativo permitido. */
const DOMINIO_CORP = "@adventistas.org";

function emailValido(email: string) {
  return email.trim().toLowerCase().endsWith(DOMINIO_CORP);
}

/** Monta o AuthUser do token a partir do usuário do banco. */
function paraAuthUser(user: AppUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    nome: user.nome,
    departamento: user.departamento ?? undefined,
    funcao: user.funcao ?? undefined,
    avatar: user.avatarUrl ?? undefined,
    papelCodigo: user.papelCodigo ?? undefined,
  };
}

/** Monta o AuthUser a partir de um UsuarioDetalhado (usado na personificação). */
function paraAuthUserDeDetalhado(usuario: UsuarioDetalhado): AuthUser {
  return {
    id: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
    departamento: usuario.departamento || undefined,
    funcao: usuario.funcao || undefined,
    avatar: usuario.fotoUrl || undefined,
    papelCodigo: usuario.papelCodigo ?? undefined,
  };
}

function podePersonificar(papelCodigo: string | undefined): boolean {
  return Boolean(
    papelCodigo &&
      (PAPEIS_QUE_PODEM_PERSONIFICAR as readonly string[]).includes(papelCodigo),
  );
}

export async function authRoutes(app: FastifyInstance) {
  /**
   * Login por e-mail + senha validado no LDAP (Microsoft AD). Na primeira vez,
   * cria o usuário local (enriquecendo com o banco legado). A senha NÃO é
   * guardada aqui — a credencial vive no AD.
   */
  app.post<{
    Body: LoginRequestBody;
    Reply: AuthTokenResponse | { message: string };
  }>(
    "/auth/login",
    {
      schema: {
        tags: ["Autenticação (LDAP) PADRÃO"],
        summary: "Login com e-mail e senha do AD (LDAP)",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const { password } = request.body;

      if (!emailValido(email)) {
        return reply
          .code(400)
          .send({ message: `Use seu e-mail corporativo (${DOMINIO_CORP}).` });
      }

      let resultadoLdap;
      try {
        resultadoLdap = await authenticateWithLdap(email, password);
        if (!resultadoLdap.ok) {
          return reply.code(401).send({ message: "Credenciais inválidas" });
        }
      } catch (error) {
        if (error instanceof LdapUnavailableError) {
          request.log.error({ error }, "LDAP indisponível");
          return reply
            .code(503)
            .send({ message: "Serviço de autenticação (LDAP) indisponível." });
        }
        throw error;
      }

      let user = await findOrCreateUsuarioLocal(email);

      // Só preenche a foto com a do AD se o usuário ainda não tiver nenhuma
      // (avatar_url vazio) — não sobrescreve uma foto já existente (ex.:
      // enviada manualmente). Só acontece no login.
      if (resultadoLdap.avatarDataUri && !user.avatarUrl) {
        const atualizado = await updateUserAvatar(user.id, resultadoLdap.avatarDataUri);
        if (atualizado) user = atualizado;
      }

      const authUser = paraAuthUser(user);
      return { token: signAuthToken(authUser), user: authUser };
    },
  );

  /* ──────────────────────────────────────────────────────────────────────
   * Login "do sistema" (e-mail + senha guardada no banco, hash scrypt).
   * Alternativa ao LDAP para contas que não estão no AD (ex.: sistema/admin).
   * ────────────────────────────────────────────────────────────────────── */

  /** Decide se o e-mail já tem senha (login) ou precisa criar (1º acesso). */
  app.post<{
    Body: CheckEmailBody;
    Reply: CheckEmailResponse | { message: string };
  }>(
    "/auth/local/check-email",
    {
      schema: {
        tags: ["Autenticação com senha no banco local (Teste)"],
        summary: "Verifica se o e-mail já tem senha (login) ou é 1º acesso",
        body: {
          type: "object",
          required: ["email"],
          properties: { email: { type: "string", format: "email" } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      if (!emailValido(email)) {
        return reply
          .code(400)
          .send({ message: `Use seu e-mail corporativo (${DOMINIO_CORP}).` });
      }
      const usuario = await getUsuarioAuthPorEmail(email);
      return { mode: usuario?.passwordHash ? "login" : "criar-senha" };
    },
  );

  /** Login local por senha no banco. */
  app.post<{
    Body: LoginRequestBody;
    Reply: AuthTokenResponse | { message: string };
  }>(
    "/auth/local/login",
    {
      schema: {
        tags: ["Autenticação"],
        summary: "Login com e-mail e senha do sistema (não usa o AD)",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const { password } = request.body;

      const usuario = await getUsuarioAuthPorEmail(email);
      if (!usuario || !usuario.passwordHash) {
        return reply.code(401).send({ message: "Credenciais inválidas" });
      }

      const ok = await verifyPassword(password, usuario.passwordHash);
      if (!ok) {
        return reply.code(401).send({ message: "Credenciais inválidas" });
      }

      // Atualiza o last_login_at (regrava o mesmo hash).
      await definirSenhaUsuario(usuario.id, usuario.passwordHash);

      const authUser = paraAuthUser(usuario);
      return { token: signAuthToken(authUser), user: authUser };
    },
  );

  /** 1º acesso do login local: define a senha (mín. 8) e já entra. */
  app.post<{
    Body: SetPasswordBody;
    Reply: AuthTokenResponse | { message: string };
  }>(
    "/auth/local/set-password",
    {
      schema: {
        tags: ["Autenticação"],
        summary: "1º acesso: define a senha do login do sistema",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      const { password } = request.body;

      if (!emailValido(email)) {
        return reply
          .code(400)
          .send({ message: `Use seu e-mail corporativo (${DOMINIO_CORP}).` });
      }

      const existente = await getUsuarioAuthPorEmail(email);
      if (existente?.passwordHash) {
        return reply
          .code(409)
          .send({ message: "Este e-mail já possui senha. Faça login." });
      }

      const passwordHash = await hashPassword(password);
      const user: AppUser | null = existente
        ? await definirSenhaUsuario(existente.id, passwordHash)
        : await criarUsuarioComSenha({ email, passwordHash });

      if (!user) {
        return reply
          .code(500)
          .send({ message: "Não foi possível definir a senha." });
      }

      const authUser = paraAuthUser(user);
      return { token: signAuthToken(authUser), user: authUser };
    },
  );

  app.get<{
    Reply: ApiResponse<AuthUser> | { message: string };
  }>(
    "/auth/me",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Autenticação"],
        summary: "Dados do usuário autenticado (a partir do token)",
      },
    },
    async (request) => {
      return {
        data: request.user,
      };
    },
  );

  /**
   * Atualização do próprio perfil (self-service): apenas cpf e telefone.
   * Não altera departamento/função/papéis (isso é da tela de Usuários / RH).
   */
  app.patch<{
    Body: UpdateMeuPerfilBody;
    Reply: ApiResponse<UsuarioDetalhado> | { message: string };
  }>(
    "/auth/me",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Autenticação"],
        summary: "Atualiza o próprio perfil (cpf/telefone)",
        body: {
          type: "object",
          properties: {
            cpf: { type: ["string", "null"] },
            telefone: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const atualizado = await atualizarPerfilProprio(
          request.user.id,
          request.body,
        );

        if (!atualizado) {
          return reply.code(404).send({ message: "Usuário não encontrado" });
        }

        return { data: atualizado };
      } catch (error) {
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
   * Personificação: RH/Admin passam a acessar o sistema como outro usuário.
   * Troca o token (não é só cosmético) — a partir daqui TODAS as chamadas
   * (férias, uploads, etc.) resolvem naturalmente para o usuário personificado,
   * porque `request.user` passa a ser ele. `personificadoPor` fica gravado no
   * token pra UI mostrar o aviso e pra rota de encerrar saber pra quem voltar.
   */
  app.post<{
    Params: { usuarioId: string };
    Reply: AuthTokenResponse | { message: string };
  }>(
    "/auth/personificar/:usuarioId",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Autenticação"],
        summary: "RH/Admin passam a acessar o sistema como outro usuário",
      },
    },
    async (request, reply) => {
      const ator = request.user;

      // Checa personificação em cadeia ANTES do papel: uma vez personificando,
      // request.user.papelCodigo passa a ser o papel do ALVO (não do ator
      // original), então essa checagem não pode depender dele.
      if (ator.personificadoPor) {
        return reply.code(409).send({
          message: "Encerre a personificação atual antes de iniciar outra.",
        });
      }

      if (!podePersonificar(ator.papelCodigo)) {
        return reply
          .code(403)
          .send({ message: "Sem permissão para personificar outro usuário." });
      }

      const { usuarioId } = request.params;

      if (usuarioId === ator.id) {
        return reply
          .code(400)
          .send({ message: "Você não pode personificar a si mesmo." });
      }

      const alvo = await getUsuarioPorId(usuarioId);
      if (!alvo) {
        return reply.code(404).send({ message: "Usuário não encontrado" });
      }

      const authUser: AuthUser = {
        ...paraAuthUserDeDetalhado(alvo),
        personificadoPor: { id: ator.id, email: ator.email, nome: ator.nome },
      };

      return { token: signAuthToken(authUser), user: authUser };
    },
  );

  /** Encerra a personificação ativa e volta a autenticar como o usuário real. */
  app.post<{
    Reply: AuthTokenResponse | { message: string };
  }>(
    "/auth/encerrar-personificacao",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Autenticação"],
        summary: "Encerra a personificação e volta ao usuário real",
      },
    },
    async (request, reply) => {
      const sessao = request.user;

      if (!sessao.personificadoPor) {
        return reply.code(400).send({ message: "Não há personificação ativa." });
      }

      const original = await getUsuarioPorId(sessao.personificadoPor.id);
      if (!original) {
        return reply
          .code(404)
          .send({ message: "Usuário original não encontrado" });
      }

      const authUser = paraAuthUserDeDetalhado(original);
      return { token: signAuthToken(authUser), user: authUser };
    },
  );
}
