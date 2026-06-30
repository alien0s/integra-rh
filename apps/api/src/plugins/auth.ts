import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { verifyAuthToken } from "../lib/jwt.js";
import { getApiConfig } from "./env.js";
import type { AuthUser } from "../types/auth.js";

const DEV_USER: AuthUser = {
  id: "dev",
  email: "dev@adventistas.org",
  nome: "Usuário Dev (auth desativada)"
};

function readBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

/**
 * Registra o middleware de autenticação JWT da API.
 *
 * Usa fastify-plugin para que o decorator `authenticate` não fique
 * encapsulado e esteja disponível para os plugins/rotas irmãos.
 */
export const authPlugin = fp(async (app: FastifyInstance) => {
  app.decorate(
    "authenticate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Auth desativada (modo dev): libera com um usuário fictício.
      if (!getApiConfig().authEnabled) {
        request.user = DEV_USER;
        return;
      }

      const token = readBearerToken(request);

      if (!token) {
        await reply.code(401).send({ message: "Token não fornecido" });
        return;
      }

      try {
        request.user = verifyAuthToken(token);
      } catch {
        await reply.code(401).send({ message: "Token inválido" });
      }
    }
  );
});
