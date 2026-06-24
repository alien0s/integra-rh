import oauthPlugin, { type OAuth2Namespace } from '@fastify/oauth2';
import type { FastifyInstance } from 'fastify';

import { upsertOAuthUser } from '../lib/database.js';
import { signAuthToken } from '../lib/jwt.js';
import { getMicrosoftUserAvatar, getMicrosoftUserInfo } from '../lib/microsoft.js';
import type { AuthUser } from '../types/auth.js';
import { getApiConfig } from './env.js';

declare module 'fastify' {
  interface FastifyInstance {
    microsoftOAuth2: OAuth2Namespace;
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
    startRedirectPath: '/auth/microsoft',
    callbackUri: config.microsoft.redirectUri,
  });

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

      const dbUser = await upsertOAuthUser({
        microsoft_id: msUser.id,
        email,
        nome: msUser.displayName,
        avatar: avatar ?? null,
        departamento: msUser.department ?? null,
        funcao: msUser.jobTitle ?? null,
      });

      const authUser: AuthUser = {
        id: dbUser.id,
        email: dbUser.email,
        nome: dbUser.nome,
        avatar: dbUser.avatar ?? undefined,
        departamento: dbUser.departamento ?? undefined,
        funcao: dbUser.funcao ?? undefined,
      };

      const token = signAuthToken(authUser);

      return reply.redirect(
        `${config.frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`,
      );
    } catch (error) {
      request.log.error({ error }, 'Falha no callback Microsoft OAuth2');
      return reply.redirect(`${config.frontendUrl}/auth/error?message=oauth_failed`);
    }
  });
}
