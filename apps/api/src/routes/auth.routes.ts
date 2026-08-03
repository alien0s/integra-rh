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
  type AppUser,
  type UsuarioDetalhado,
} from "../lib/database.js";
import type {
  AuthTokenResponse,
  AuthUser,
  CheckEmailBody,
  CheckEmailResponse,
  LoginRequestBody,
  SetPasswordBody,
  UpdateMeuPerfilBody,
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
  };
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

      try {
        const autenticado = await authenticateWithLdap(email, password);
        if (!autenticado) {
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

      const user = await findOrCreateUsuarioLocal(email);
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
  }>("/auth/me", { onRequest: [app.authenticate] }, async (request) => {
    return {
      data: request.user,
    };
  });

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
}
