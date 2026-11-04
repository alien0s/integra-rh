# Documentação interativa da API (Swagger/Scalar)

A API publica sua própria documentação OpenAPI, gerada automaticamente a
partir do `schema` de cada rota — não é um arquivo mantido à mão, então o
conteúdo (parâmetros, corpo, tags) nunca fica desatualizado por si só. O que
pode ficar desatualizado é a **organização** (tags) e o **texto** (`summary`/
`description`) que cada rota declara — é isso que este documento cobre.

---

## 1. Acesso — só ADMIN

Implementado em [`app.ts`](../apps/api/src/app.ts), bloco que registra
`@scalar/fastify-api-reference` na rota `/reference`.

**Pelo app (forma normal)**: Configurações → "Documentação da API" (item só
aparece pra ADMIN — ver
[`ConfiguracoesNav.tsx`](../apps/web/src/features/configuracoes/components/ConfiguracoesNav.tsx)),
botão "Abrir documentação"
([`DocumentacaoApiSection.tsx`](../apps/web/src/features/configuracoes/components/DocumentacaoApiSection.tsx)).
Abre `/reference` já autenticado numa aba nova. Necessário porque, diferente
de toda chamada normal da API (que sai de um `fetch` do próprio front e já
anexa o header `Authorization` a partir do token no `localStorage`), esta
página é aberta direto no navegador — sem nenhum JS do app ali pra anexar
header nenhum —, então o botão passa o token por querystring
(`/reference/?token=...`), que o guard abaixo também aceita como alternativa
ao Bearer (mesma necessidade do stream SSE de notificações,
`GET /notificacoes/stream`).

Só a própria página HTML carrega com `?token=` na URL — o
`<script src="js/scalar.js">` e o fetch interno de `openapi.json` que a
página dispara em seguida são requisições novas, sem querystring nenhuma (o
navegador não repete a query da página nos recursos que ela carrega). Por
isso o guard, ao autenticar com sucesso via querystring, grava um cookie
`reference_token` de curta duração (`httpOnly`, 1h) — as requisições
seguintes da mesma página autenticam por ele, sem precisar do token na URL de
novo. Esse cookie só vale pra essas 4 rotas (o resto da API continua
ignorando-o, só aceita o header `Authorization`).

Endereços diretos (uso manual/debug — abrir só pela URL não autentica
sozinho; precisa do `?token=` ou de um `Authorization` anexado por fora,
ex.: extensão de navegador ou curl/Postman):

- **Dev**: `http://localhost:3002/reference/`.
- **Produção**: **`https://integra.aceam.org.br/api/reference/`** — não
  precisa de VPN, túnel ou porta nenhuma: o nginx já repassa tudo que começa
  com `/api/` pro Fastify (`location /api/`, ver
  [`deploy/nginx/integra.conf`](../deploy/nginx/integra.conf)), e isso inclui
  `/api/reference`. O controle de quem acessa não é de rede (a rota já é
  pública como qualquer outra de `/api`) — é o guard de ADMIN descrito
  abaixo, mesmo modelo usado no resto da API.
  > ⚠️ **Use a barra final** (`/api/reference/`, não `/api/reference`). Sem
  > ela, o próprio Scalar redireciona pra `/reference/` — sem o prefixo
  > `/api` — porque ele só enxerga o caminho já sem esse prefixo (o nginx tira
  > o `/api/` antes de repassar). Como não existe `location /reference` no
  > nginx, esse redirecionamento cai no SPA e parece "página em branco".

Até a auditoria que originou este documento, `/reference` era **pública**:
qualquer um com acesso de rede à API via a UI e o spec OpenAPI completo (todas
as rotas, parâmetros, quais papéis cada uma exige) sem login. Isso foi
corrigido com um `hooks.onRequest` passado à própria configuração do plugin,
que roda `app.authenticate` + `exigirPapeis()` (sem papéis extras = **ADMIN
only**, mesma convenção usada em todas as outras rotas admin-only da API — ver
[`plugins/auth.ts`](../apps/api/src/plugins/auth.ts)) em frente das 4 rotas
que o Scalar registra (página HTML, o JS da página, e o spec em
`/reference/openapi.json` e `/reference/openapi.yaml`):

| Quem acessa | Resultado |
|---|---|
| Sem token | `401` |
| Autenticado, papel ≠ ADMIN | `403` |
| ADMIN | `200` |

> **Pendência de deploy**: este guard (e as correções de tags da seção 2)
> estão no código-fonte, mas o processo em produção (PM2, `integra-api`) só
> relê isso num redeploy da API (`pnpm build:api && pm2 restart integra-api`)
> — até lá, `https://integra.aceam.org.br/api/reference/` continua aberta
> sem exigir login pra qualquer um. O botão em Configurações também é código
> novo: precisa do redeploy do **front** (`pnpm build:web` + copiar
> `apps/web/dist/*` pra `/var/www/integra`, ver
> [`deploy/README.md`](../deploy/README.md)) pra aparecer em produção. Remova
> este aviso depois dos dois redeploys.

---

## 2. Como o spec é montado (para não ficar desatualizado de novo)

1. `app.register(swagger, { openapi: {...} })` em `app.ts` define o
   documento base (título, segurança Bearer/JWT) e o array `tags` — que
   define **os grupos e a ordem da sidebar** do Scalar.
2. Cada arquivo em `apps/api/src/routes/*.ts` declara, por rota,
   `schema.tags` (um array com 1 nome de grupo), `schema.summary` e, quando
   recebe dado, `schema.body`/`querystring`/`params`. O hook `onRoute` do
   `@fastify/swagger` captura isso automaticamente — toda rota nova com
   `schema` preenchido já aparece no `/reference` sem nenhum passo manual.
3. **Se uma rota usa um `tag` que não está no array `tags` de `app.ts`, ela
   ainda aparece no spec** — mas como um grupo "órfão", sem a descrição e
   fora da ordem pensada para a sidebar. Era o caso de `"Férias"`, `"VR"`,
   `"Feriados"`, `"Notificações"` e `"Tabelas — Visibilidade de módulos"`
   antes desta auditoria (módulos adicionados depois do array original) — os
   5 grupos foram adicionados ao array. **Ao criar um módulo novo, adicione o
   tag ao array em `app.ts` junto com a primeira rota que o usa.**
4. `schema.description` está vazio em **todas** as rotas hoje — só
   `summary` (uma linha) é preenchido. Não é um requisito automatizado, mas é
   o campo certo para explicar uma regra não óbvia de uma rota específica
   (ver seção 4) em vez de um comentário solto no código da rota.

---

## 3. Grupos (tags) e onde cada um vive

| Tag | Arquivo de rotas |
|---|---|
| Autenticação | `auth.routes.ts` |
| Usuários | `usuarios.routes.ts`, `uploads.routes.ts` |
| Tabelas — Entidades / Setores / Funções / Papéis | `tabelas.routes.ts` |
| Tabelas — Visibilidade de módulos | `tabelas.routes.ts` |
| VR | `vr.routes.ts` |
| Férias | `ferias.routes.ts` |
| Feriados | `feriados.routes.ts` |
| Notificações | `notificacoes.routes.ts` |
| Cursos e Qualificações | `qualificacoes.routes.ts` |
| Comunicação | `comunicacao.routes.ts` |
| Logs | `logs.routes.ts` |

---

## 4. O que o Swagger **não** mostra sozinho

O `onRequest` que aparece no schema de cada rota (`app.authenticate`,
`bloquearColaborador`, `exigirPapeis(...)`) é real, mas algumas restrições
vivem fora dele e não aparecem na UI — quem for liberar acesso ou debugar um
403 precisa saber que elas existem:

- **`VR` (`vr.routes.ts`)**: quase toda rota declara só
  `onRequest: [app.authenticate]` no schema — a restrição de papel de
  verdade (`ADMIN, DP, COORDENADOR DP, ASSISTENTE, TESOUREIRO`, com escopo
  por grupo de entidades) vem de `app.addHook("preHandler", ...)` no topo do
  arquivo (`podeGerenciarVr`), que cobre todas as rotas do módulo de uma vez.
- **`Cursos e Qualificações` (`qualificacoes.routes.ts`)**: a fila de
  moderação e as rotas de aprovar/recusar exigem RH/ADMIN, mas essa checagem
  (`ehRh(...)`) é feita **dentro do handler**, não aparece em `onRequest`.
- **Lançamento beta** (`exigirAcessoBeta`, em `ferias.routes.ts` e
  `qualificacoes.routes.ts` via `app.addHook("preHandler", ...)` no topo do
  arquivo): enquanto `LANCAMENTO_BETA_ATIVO` estiver `true`
  ([`plugins/auth.ts`](../apps/api/src/plugins/auth.ts)), só ADMIN e quem foi
  liberado antecipadamente (configurável pelo ADMIN na tela **Tabelas** →
  Visibilidade de módulos) acessam essas rotas — independente do papel.
- **Rotas públicas de propósito** (sem `app.authenticate`, com
  `security: []` explícito no schema): `GET /usuarios/:usuarioId/avatar`
  (a tag `<img>` do navegador não envia `Authorization`) e
  `GET /notificacoes/stream` (SSE — `EventSource` também não manda header
  custom; a auth é feita via token na querystring, dentro do handler).

---

## 5. Checklist ao criar uma rota nova

1. `schema.tags: ["Nome do grupo"]` — se o grupo é novo, adicione-o também ao
   array `tags` de `app.ts` (nome **e** descrição), na mesma PR.
2. `schema.summary` — uma linha, verbo + o que a rota faz.
3. Se a rota tem uma regra de acesso que não aparece no `onRequest` (hook de
   plugin, checagem manual no handler — ver seção 4), registre isso em
   `schema.description`, não só em comentário no código.
4. Rota pública de propósito (sem `app.authenticate`)? Declare
   `security: []` no schema, como já é feito em `GET /usuarios/:usuarioId/avatar`
   — sem isso, o Scalar mostra a rota como exigindo Bearer mesmo que ela não
   exija.
