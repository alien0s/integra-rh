import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { runMigrations } from "./lib/database.js";
import { authPlugin } from "./plugins/auth.js";
import { getApiConfig } from "./plugins/env.js";
import { microsoftOAuthPlugin } from "./plugins/microsoft-oauth.js";
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
  app.register(cookie);

  app.addHook("onReady", async () => {
    if (!config.database.url) {
      app.log.warn("DATABASE_URL não configurado — migrações ignoradas");
      return;
    }

    try {
      await runMigrations();
      app.log.info("Migrações do banco aplicadas com sucesso");
    } catch (error) {
      app.log.warn(
        { error },
        "Não foi possível conectar ao PostgreSQL — migrações ignoradas. " +
          "O login Microsoft (SSO) não funcionará até o banco estar disponível."
      );
    }
  });

  app.get("/", async () => ({
    name: "@erp/api",
    status: "running"
  }));

  app.register(authPlugin);
  app.register(microsoftOAuthPlugin);
  app.register(healthRoutes);
  app.register(authRoutes);
  app.register(funcionariosRoutes);
  app.register(folhasRoutes);

  return app;
}
