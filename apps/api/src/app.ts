import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import Fastify from "fastify";

import { checkDatabaseConnection } from "./lib/database.js";
import { ensureBucket } from "./lib/storage.js";
import { authPlugin } from "./plugins/auth.js";
import { getApiConfig } from "./plugins/env.js";
import { microsoftOAuthPlugin } from "./plugins/microsoft-oauth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { tabelasRoutes } from "./routes/tabelas.routes.js";
import { uploadsRoutes } from "./routes/uploads.routes.js";
import { usuariosRoutes } from "./routes/usuarios.routes.js";

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
  app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 } // 5 MB por arquivo
  });

  // Gera o OpenAPI a partir dos schemas das rotas (precisa vir antes dos
  // registros de rotas abaixo, para capturar todas via seu hook onRoute).
  app.register(swagger, {
    openapi: {
      info: {
        title: "IntegraRH API",
        description: "API do ERP de RH — autenticação, usuários, tabelas de apoio e uploads.",
        version: "1.0.0"
      },
      servers: [{ url: "/" }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        }
      },
      security: [{ bearerAuth: [] }],
      // Define os grupos (e a ordem) da sidebar do Scalar. Cada rota entra
      // num grupo via `schema.tags` — sem tag, a rota cai fora dos grupos.
      tags: [
        {
          name: "Autenticação",
          description: "Login (LDAP/AD, sistema local, Microsoft SSO) e dados do usuário logado."
        },
        {
          name: "Usuários",
          description: "Cadastro de usuários, foto de perfil e listas de apoio para os formulários."
        },
        { name: "Tabelas — Entidades", description: "CRUD de empresas/organizações do ERP." },
        { name: "Tabelas — Departamentos", description: "CRUD de departamentos/setores." },
        { name: "Tabelas — Funções", description: "CRUD de funções/cargos." },
        { name: "Tabelas — Papéis", description: "CRUD de papéis/perfis de acesso." }
      ]
    }
  });

  // Documentação interativa (Scalar), servida em /reference a partir do
  // OpenAPI gerado acima pelo @fastify/swagger. Registrada num escopo à
  // parte com CSP relaxado: a página do Scalar usa um <script> inline pra
  // inicializar (script-src 'unsafe-inline', senão o CSP padrão bloquearia) e
  // não pode forçar HTTPS (upgrade-insecure-requests: null), já que a API
  // roda em HTTP puro — em qualquer origem que não seja "localhost", o
  // navegador trata isso como origem insegura e passa a exigir TLS de
  // verdade em toda a página, quebrando o carregamento do script do Scalar.
  app.register(async (scope) => {
    scope.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "'unsafe-inline'"],
          "upgrade-insecure-requests": null
        }
      }
    });
    scope.register(scalarApiReference, {
      routePrefix: "/reference",
      configuration: {
        // Título da aba do navegador na página de documentação.
        pageTitle: "IntegraRH API documentação"
      }
    });
  });

  app.addHook("onReady", async () => {
    if (!config.database.name) {
      app.log.warn("DB_NAME não configurado — conexão com o banco ignorada");
    } else {
      try {
        await checkDatabaseConnection();
        app.log.info(
          `PostgreSQL conectado em ${config.database.host}:${config.database.port}/${config.database.name}`
        );
      } catch (error) {
        app.log.warn(
          { error },
          "Não foi possível conectar ao PostgreSQL. " +
            "O login Microsoft (SSO) não funcionará até o banco estar disponível."
        );
      }
    }

    if (!config.storage.accessKey) {
      app.log.warn("S3_ACCESS_KEY não configurado — storage (MinIO) ignorado");
    } else {
      try {
        await ensureBucket();
        app.log.info(`Storage pronto — bucket "${config.storage.bucket}"`);
      } catch (error) {
        app.log.warn(
          { error },
          "Não foi possível conectar ao storage (MinIO/S3). Uploads ficarão indisponíveis."
        );
      }
    }
  });

  app.register(authPlugin);
  app.register(microsoftOAuthPlugin);
  app.register(authRoutes);
  app.register(usuariosRoutes);
  app.register(tabelasRoutes);
  app.register(uploadsRoutes);

  return app;
}
