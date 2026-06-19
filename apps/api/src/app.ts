import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { authPlugin } from "./plugins/auth.js";
import { getApiConfig } from "./plugins/env.js";
import { authRoutes } from "./routes/auth.routes.js";
import { folhasRoutes } from "./routes/folhas.routes.js";
import { funcionariosRoutes } from "./routes/funcionarios.routes.js";
import { healthRoutes } from "./routes/health.routes.js";

export function buildApp() {
  const config = getApiConfig();
  const app = Fastify({
    logger: true
  });

  app.register(cors, {
    credentials: true,
    origin: config.frontendUrl
  });
  app.register(helmet);

  app.get("/", async () => ({
    name: "@erp/api",
    status: "running"
  }));

  app.register(authPlugin);
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(funcionariosRoutes);
  app.register(folhasRoutes);

  return app;
}
