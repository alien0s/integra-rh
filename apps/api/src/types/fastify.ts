import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthUser } from "./auth.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    user: AuthUser;
  }
}
