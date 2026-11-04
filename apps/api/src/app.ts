import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";

import { checkDatabaseConnection } from "./lib/database.js";
import { iniciarJobsComunicacao } from "./lib/comunicacao.cron.js";
import { registrarErroDaRequisicao } from "./lib/logs.js";
import { ensureBucket } from "./lib/storage.js";
import { authPlugin, exigirPapeis } from "./plugins/auth.js";
import { getApiConfig } from "./plugins/env.js";
import { microsoftOAuthPlugin } from "./plugins/microsoft-oauth.js";
import { authRoutes } from "./routes/auth.routes.js";
import { comunicacaoRoutes } from "./routes/comunicacao.routes.js";
import { feriadosRoutes } from "./routes/feriados.routes.js";
import { feriasRoutes } from "./routes/ferias.routes.js";
import { vrRoutes} from "./routes/vr.routes.js";
import { logsRoutes } from "./routes/logs.routes.js";
import { notificacoesRoutes } from "./routes/notificacoes.routes.js";
import { qualificacoesRoutes } from "./routes/qualificacoes.routes.js";
import { tabelasRoutes } from "./routes/tabelas.routes.js";
import { uploadsRoutes } from "./routes/uploads.routes.js";
import { usuariosRoutes } from "./routes/usuarios.routes.js";

/** Cookie que carrega o token entre as requisições da página de /reference. */
const REFERENCE_TOKEN_COOKIE = "reference_token";

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
        description:
          "API do ERP de RH — autenticação, usuários, tabelas de apoio, férias, VR, feriados, cursos e qualificações, comunicação, notificações e logs.",
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
        { name: "Tabelas — Setores", description: "CRUD de setores." },
        { name: "Tabelas — Funções", description: "CRUD de funções/cargos." },
        { name: "Tabelas — Papéis", description: "CRUD de papéis/perfis de acesso." },
        {
          name: "Tabelas — Visibilidade de módulos",
          description: "Matriz (módulo × papel) que controla o que cada papel vê no menu e pode acessar, e o cadeado de lançamento beta."
        },
        {
          name: "VR",
          description: "Lançamentos de vale-refeição por mês/entidade, com fechamento e papéis de gestão (DP, Coordenador DP, Assistente, Tesoureiro)."
        },
        {
          name: "Férias",
          description: "Solicitação, aprovação e acompanhamento de férias — fluxo gestor → DP/RH, com exceções e calendário de equipe."
        },
        {
          name: "Férias — Fluxo de aprovação",
          description: "Configuração (ADMIN) de exceções ao fluxo padrão de aprovação de férias por grupo de entidade ou usuário — ainda não conectada à decisão real."
        },
        {
          name: "Feriados",
          description: "Cadastro de feriados por ano, com importação (inclusive do sistema legado)."
        },
        {
          name: "Notificações",
          description: "Caixa de entrada por usuário — avisos de ações que exigem atenção (ex.: aprovar férias) e marcação de lidas."
        },
        {
          name: "Cursos e Qualificações",
          description: "Formação acadêmica, cursos/workshops/certificações e idiomas do colaborador, com aprovação do RH."
        },
        {
          name: "Comunicação",
          description: "Avisos e campanhas internas, com fluxo de aprovação do RH."
        },
        {
          name: "Logs",
          description: "Log de erros inesperados do backend, para diagnóstico (uso interno, ADMIN)."
        }
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
      },
      // Documentação expõe toda a superfície da API (rotas, payloads,
      // papéis exigidos) — só ADMIN acessa. `hooks.onRequest` do próprio
      // plugin cobre as 4 rotas que ele registra (página HTML, JS, e o spec
      // em /reference/openapi.json e .../yaml), não só a UI.
      // `app.authenticate` é referenciado aqui dentro de uma função (não
      // passado direto), porque nesse ponto do arquivo authPlugin ainda não
      // registrou o decorator — só precisa existir quando a requisição
      // chegar, não agora.
      hooks: {
        onRequest: async (request: FastifyRequest, reply: FastifyReply) => {
          // Diferente de toda outra rota da API (chamada via fetch do próprio
          // front, que anexa o header Authorization a partir do localStorage),
          // esta é aberta direto no navegador (clique/URL) — sem JS do app
          // rodando ali pra anexar header nenhum. Aceita o token também por
          // querystring (?token=...) como alternativa ao Bearer; mesma
          // necessidade e solução do stream SSE de notificações
          // (GET /notificacoes/stream).
          //
          // Só a página HTML em si carrega com ?token= na própria URL — o
          // <script src="js/scalar.js"> e o fetch interno de openapi.json que
          // a página dispara são requisições NOVAS, sem querystring nenhuma
          // (o navegador não repete a query da página nos recursos que ela
          // carrega). Por isso, ao autenticar via querystring, grava um
          // cookie de curta duração: as requisições seguintes da MESMA
          // página passam a autenticar por ele, sem precisar do token na URL.
          const { token: queryToken } = request.query as { token?: string };
          const token = queryToken ?? request.cookies[REFERENCE_TOKEN_COOKIE];
          if (token && !request.headers.authorization) {
            request.headers.authorization = `Bearer ${token}`;
          }
          await app.authenticate(request, reply);
          if (reply.sent) return;
          await exigirPapeis()(request, reply);
          if (reply.sent) return;

          if (queryToken) {
            reply.setCookie(REFERENCE_TOKEN_COOKIE, queryToken, {
              path: "/",
              httpOnly: true,
              sameSite: "lax",
              // Não "secure": a API ainda roda em HTTP puro (ver comentário
              // acima, sobre upgrade-insecure-requests) — com secure, o
              // navegador nunca devolveria o cookie.
              maxAge: 60 * 60 // 1h — só pra navegar a doc, não é a sessão do app
            });
          }
        }
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

  // Captura qualquer erro não tratado que escape de uma rota (ex.: um
  // `throw error;` no fim de um catch que só reconhece erros específicos, uma
  // falha sem try/catch nenhum — como era o upload de diploma antes disso
  // existir —, ou um erro interno do próprio Fastify/plugin, como o
  // @fastify/multipart recusando um arquivo maior que o limite). Rotas que já
  // capturam o erro e respondem via `reply.code(x).send(...)` retornam ANTES
  // de chegar aqui — comportamento delas não muda.
  //
  // TODO sempre vira uma linha em logs_erros, mesmo quando o status é < 500
  // (ver lib/logs.ts): já tentamos logar só >= 500, mas isso escondia casos
  // reais — ex.: @fastify/multipart responde 413 ("request file too large")
  // quando o diploma passa do limite (ver TAMANHO_MAXIMO_ANEXO_MB no front),
  // e esse 413 também nunca passa pelo catch da rota (que não sabe desse
  // limite). Status >= 500 não é um bom proxy pra "a rota não esperava" — o
  // que de fato distingue é só chegar aqui: toda rota que reconhece uma
  // condição já responde e retorna antes deste handler, não importa o
  // código. A mensagem pro cliente continua diferenciando por status (ver
  // abaixo) — só o registro no log parou de filtrar.
  //
  // A lista de exemplos exibida pro admin (o que já foi observado passando
  // por aqui) fica documentada em
  // apps/web/src/features/logs/components/LogsErrosSection.tsx
  // (FONTES_CONHECIDAS) — vale manter atualizada ao criar uma feature nova
  // que possa gerar um erro inesperado relevante.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode ?? 500;

    request.log.error({ err: error }, "Erro não tratado");

    void registrarErroDaRequisicao(error, request);

    reply.status(statusCode).send({
      message: statusCode >= 500 ? "Erro interno do servidor." : error.message,
    });
  });

  app.register(authPlugin);
  app.register(microsoftOAuthPlugin);
  app.register(authRoutes);
  app.register(usuariosRoutes);
  app.register(tabelasRoutes);
  app.register(uploadsRoutes);
  app.register(vrRoutes);
  app.register(feriasRoutes);
  app.register(feriadosRoutes);
  app.register(notificacoesRoutes);
  app.register(qualificacoesRoutes);
  app.register(comunicacaoRoutes);
  app.register(logsRoutes);

  iniciarJobsComunicacao();

  return app;
}