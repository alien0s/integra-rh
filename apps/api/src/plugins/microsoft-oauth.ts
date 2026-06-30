import oauthPlugin, { type OAuth2Namespace } from '@fastify/oauth2';
import type { FastifyInstance } from 'fastify';

import { findOrCreateUser } from '../lib/database.js';
import { signAuthToken } from '../lib/jwt.js';
import { getMicrosoftUserAvatar, getMicrosoftUserInfo } from '../lib/microsoft.js';
import type { AuthUser } from '../types/auth.js';
import { getApiConfig } from './env.js';

declare module 'fastify' {
  interface FastifyInstance {
    microsoftOAuth2: OAuth2Namespace;
  }
}

/** Traduz erros (em especial do PostgreSQL) numa mensagem clara do motivo. */
function descreverErro(error: unknown): string {
  const e = error as {
    code?: string;
    message?: string;
    detail?: string;
    column_name?: string;
    constraint_name?: string;
  };

  switch (e?.code) {
    case '23502': // not_null_violation
      return `O campo "${e.column_name ?? '?'}" é obrigatório no banco e não foi preenchido. Torne-o opcional ou peça ao RH para completar o cadastro.`;
    case '23514': // check_violation
      return String(e.constraint_name ?? '').includes('email')
        ? 'E-mail não autorizado: o login precisa ser de uma conta @adventistas.org.'
        : `Restrição do banco violada: ${e.constraint_name ?? 'desconhecida'}.`;
    case '23505': // unique_violation
      return `Registro já existente: ${e.detail ?? 'violação de unicidade'}.`;
    default:
      return e?.message ?? 'Erro desconhecido ao processar o login.';
  }
}

export async function microsoftOAuthPlugin(app: FastifyInstance) {
  const config = getApiConfig();

  await app.register(oauthPlugin, {
    name: 'microsoftOAuth2',
    credentials: {
      client: {
        id: config.microsoft.clientId,
        secret: config.microsoft.clientSecret,
      },
      auth: {
        authorizeHost: 'https://login.microsoftonline.com',
        authorizePath: `/${config.microsoft.tenantId}/oauth2/v2.0/authorize`,
        tokenHost: 'https://login.microsoftonline.com',
        tokenPath: `/${config.microsoft.tenantId}/oauth2/v2.0/token`,
      },
    },
    scope: ['openid', 'profile', 'email', 'User.Read'],
    // Sem startRedirectPath: usamos a rota própria abaixo para injetar login_hint.
    callbackUri: config.microsoft.redirectUri,
  });

  // Início do fluxo OAuth2. Recebe o email digitado na tela de login e o repassa
  // como login_hint, fazendo a Microsoft já abrir com o email preenchido.
  app.get<{ Querystring: { login_hint?: string } }>(
    '/auth/microsoft',
    async (request, reply) => {
      const uri = await app.microsoftOAuth2.generateAuthorizationUri(request, reply);
      const loginHint = request.query.login_hint?.trim();

      if (!loginHint) {
        return reply.redirect(uri);
      }

      const authUrl = new URL(uri);
      authUrl.searchParams.set('login_hint', loginHint);
      return reply.redirect(authUrl.toString());
    },
  );

  app.get('/auth/microsoft/callback', async (request, reply) => {
    try {
      const tokenResponse =
        await app.microsoftOAuth2.getAccessTokenFromAuthorizationCodeFlow(request, reply);
      const accessToken = tokenResponse.token.access_token as string;

      const [msUser, avatar] = await Promise.all([
        getMicrosoftUserInfo(accessToken),
        getMicrosoftUserAvatar(accessToken),
      ]);

      const email = msUser.mail ?? msUser.userPrincipalName;

      const dbUser = await findOrCreateUser({
        email,
        nome: msUser.displayName,
        avatarUrl: avatar ?? null,
      });

      const authUser: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        nome: dbUser.nome,
        avatar: dbUser.avatarUrl ?? undefined,
        departamento: dbUser.departamento ?? undefined,
        funcao: dbUser.funcao ?? undefined,
      };

      const token = signAuthToken(authUser);

      return reply.redirect(
        `${config.frontendUrl}/login?token=${encodeURIComponent(token)}`,
      );
    } catch (error) {
      const motivo = descreverErro(error);
      request.log.error({ error }, `Falha no login Microsoft: ${motivo}`);
      return reply.redirect(
        `${config.frontendUrl}/login?error=${encodeURIComponent(motivo)}`,
      );
    }
  });
}
