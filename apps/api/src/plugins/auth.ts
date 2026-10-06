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

/**
 * Bloqueia COLABORADOR (403). Roda depois de `app.authenticate` (precisa de
 * `request.user` já preenchido) — usar sempre como
 * `onRequest: [app.authenticate, bloquearColaborador]`.
 *
 * COLABORADOR só vê os próprios dados (ex.: férias — usa /ferias/minhas, não
 * /ferias). Papéis acima dele (COORDENADOR, GESTOR, ASSISTENTE, TESOUREIRO,
 * PRESIDENTE, ADMIN) passam livremente por aqui — a definição de quem mais
 * deve ter acesso restrito fica pra quando os outros papéis forem definidos.
 * `papelCodigo` undefined (auth desativada/modo dev) também passa.
 */
export async function bloquearColaborador(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (request.user.papelCodigo === "COLABORADOR") {
    await reply
      .code(403)
      .send({ message: "Sem permissão para acessar este recurso." });
  }
}

/**
 * Cria um preHandler que exige que o usuário tenha um dos `codigos` de papel
 * informados. ADMIN sempre passa. `papelCodigo` undefined (auth desativada/
 * modo dev) também passa, para não travar o desenvolvimento local.
 *
 * Uso: `onRequest: [app.authenticate, exigirPapeis("DP")]`.
 */
export function exigirPapeis(...codigos: string[]) {
  const permitidos = new Set([...codigos, "ADMIN"]);
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const papel = request.user.papelCodigo;
    if (papel === undefined) return; // modo dev / auth desativada
    if (!permitidos.has(papel)) {
      await reply
        .code(403)
        .send({ message: "Sem permissão para esta ação." });
    }
  };
}

/**
 * Lançamento pra algumas pessoas (por enquanto): só ADMIN acessa Férias e
 * Qualificações (Qualificações também libera RH, que já modera cursos/
 * formações/idiomas nessas telas — ver `exigirAdminOuPapeisDuranteBeta`
 * abaixo) — espelha `RequireLancamentoBeta`
 * (apps/web/src/features/auth/components/AuthGuards.tsx, mesmo nome de flag
 * `LANCAMENTO_BETA_ATIVO`), que já bloqueia a navegação no front pra
 * qualquer não-admin (ou não-liberado). Sem isso aqui, o front escondia o
 * menu/redirecionava, mas a API continuava aceitando GESTOR/DP/RH/COLABORADOR
 * normalmente — bastava chamar a rota direto (Postman/curl) pra contornar.
 *
 * Registrado como hook de `preHandler` no nível do plugin (`app.addHook`
 * dentro de `feriasRoutes`/`qualificacoesRoutes`), não em cada rota — roda
 * DEPOIS de `app.authenticate` (fase `onRequest`, já populou `request.user`)
 * e ANTES dos preHandlers de cada rota, então cobre todas as rotas do
 * arquivo automaticamente, sem precisar editar rota por rota.
 *
 * Desative os dois juntos (aqui e no front) quando lançar geral.
 */
const LANCAMENTO_BETA_ATIVO = true;

export async function exigirAdminDuranteBeta(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!LANCAMENTO_BETA_ATIVO) return;
  const papel = request.user.papelCodigo;
  if (papel === undefined || papel === "ADMIN") return; // dev / ADMIN passam
  await reply
    .code(403)
    .send({ message: "Este recurso está em lançamento restrito no momento." });
}

/**
 * Variante de `exigirAdminDuranteBeta` que também libera os papéis em
 * `papeisExtras` (além de ADMIN) — usada em Qualificações, onde RH já tem
 * permissão de moderar (aprovar/recusar) cursos/formações/idiomas fora do
 * beta; sem essa liberação, RH esbarrava no bloqueio do lançamento antes
 * mesmo de chegar na checagem de papel da própria rota.
 */
export function exigirAdminOuPapeisDuranteBeta(papeisExtras: Iterable<string>) {
  const extras = new Set(papeisExtras);
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!LANCAMENTO_BETA_ATIVO) return;
    const papel = request.user.papelCodigo;
    if (papel === undefined || papel === "ADMIN" || (papel && extras.has(papel))) return;
    await reply
      .code(403)
      .send({ message: "Este recurso está em lançamento restrito no momento." });
  };
}
