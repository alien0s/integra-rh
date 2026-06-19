import type { FastifyInstance } from "fastify";

import { authenticateWithLdap, LdapUnavailableError } from "../lib/ldap.js";
import { signAuthToken } from "../lib/jwt.js";
import type {
  AuthTokenResponse,
  AuthUser,
  LoginRequestBody
} from "../types/auth.js";
import type { ApiResponse } from "../types/api.js";

function createAuthenticatedUser(email: string): AuthUser {
  return {
    id: email,
    email,
    nome: email.split("@")[0] ?? email
  };
}

export async function authRoutes(app: FastifyInstance) {
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
            password: { type: "string", minLength: 1 }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      const { email, password } = request.body;

      try {
        const authenticated = await authenticateWithLdap(email, password);

        if (!authenticated) {
          return reply.code(401).send({ message: "Credenciais inválidas" });
        }
      } catch (error) {
        if (error instanceof LdapUnavailableError) {
          request.log.error({ error }, "LDAP indisponível");
          return reply.code(503).send({ message: "LDAP indisponível" });
        }

        throw error;
      }

      const user = createAuthenticatedUser(email);

      return {
        token: signAuthToken(user),
        user
      };
    }
  );

  app.get<{
    Reply: ApiResponse<AuthUser> | { message: string };
  }>("/auth/me", { onRequest: [app.authenticate] }, async (request) => {
    return {
      data: request.user
    };
  });
}
