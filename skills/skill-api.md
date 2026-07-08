Padrão de estrutura, rotas, acesso a dados e convenções do backend (Fastify).# Estrutura da API — Fastify + PostgreSQL

## 🎯 Objetivo

Padrão **oficial** do backend `apps/api`. A IA DEVE consultar esta skill antes de
criar qualquer rota, função de acesso a dados, plugin ou tipo na API. Substitui o
antigo `skill-temp-api.md` (que descrevia uma stack diferente da atual).

## 🧱 Stack real (não invente outra)

- **Fastify 5** + **ESM** (`"type": "module"`) — todo import local termina em `.js`.
- **TypeScript** rodando com **`tsx watch`** em dev (`tsx watch --env-file=../../.env src/server.ts`).
- **PostgreSQL** via lib **`postgres`** (porsager) — tagged templates, NÃO usar `pg`/ORM.
- **JWT próprio** em `lib/jwt.ts` (HS256) — NÃO usar `jsonwebtoken`/`@fastify/jwt`.
- **Config centralizada** em `plugins/env.ts` (`getApiConfig()`), lendo o `.env` da **raiz** do monorepo.
- **Object storage** (MinIO/S3) via `@aws-sdk/client-s3` em `lib/storage.ts`.

---

## 📁 Estrutura de pastas

```
apps/api/
├── db/
│   ├── migrations/        # DDL versionado: 001_*.sql, 002_*.sql ...
│   └── seeds/             # dados iniciais: 001_seed_*.sql
└── src/
    ├── server.ts          # entry point: buildApp() + app.listen()
    ├── app.ts             # buildApp(): registra plugins, rotas e hooks (onReady)
    ├── plugins/           # infra transversal (Fastify plugins/decorators)
    │   ├── env.ts         # getApiConfig(): ApiConfig tipado a partir de process.env
    │   ├── auth.ts        # authPlugin → decorator app.authenticate (JWT)
    │   └── microsoft-oauth.ts
    ├── lib/               # 🔥 CAMADA DE DADOS/INTEGRAÇÃO (o "service/repository")
    │   ├── database.ts    # cliente postgres + funções de query (list/get/create/update)
    │   ├── storage.ts     # MinIO/S3 (upload, stream, presign)
    │   ├── jwt.ts         # assinar/verificar token
    │   ├── microsoft.ts   # Microsoft Graph
    │   └── ldap.ts
    ├── routes/
    │   └── *.routes.ts     # 🔥 CONTROLLERS: cada arquivo exporta async function xRoutes(app)
    └── types/
        ├── api.ts         # ApiResponse<T>, ApiListResponse<T>
        ├── auth.ts        # AuthUser, LoginRequestBody...
        └── fastify.ts     # module augmentation (app.authenticate, request.user)
```

---

## 📚 Camadas e fluxo de dados

```
routes/*.routes.ts   (HTTP: valida entrada, monta resposta — SEM SQL)
      ↓  chama
lib/database.ts      (acesso a dados: query SQL, mapeamento; SEM Fastify)
      ↓
PostgreSQL / MinIO
```

**Regra de ouro:**
- **Rota** = controller fino: valida (schema), chama uma função da `lib/`, devolve o envelope. Sem SQL, sem regra de negócio pesada.
- **`lib/`** = acesso a dados e integrações. Funções puras que recebem/retornam tipos, executam SQL. Sem `request`/`reply`, sem Fastify.
- **`plugins/`** = coisas transversais (config, auth, cors) registradas no `app.ts`.

> Diferente do front (que tem `services/` por feature), no backend a **`lib/` é a camada de serviço**. Não crie pasta `services/`. Quando `database.ts` crescer demais, divida por domínio (`lib/db/usuarios.ts`, `lib/db/ferias.ts`), mantendo o mesmo padrão.

---

## 🌐 Padrão de ROTA

Cada recurso é um arquivo `xxx.routes.ts` que exporta `export async function xxxRoutes(app: FastifyInstance)` e é registrado no `app.ts`.

```typescript
import type { FastifyInstance } from "fastify";

import { listUsuarios, type UsuarioDetalhado } from "../lib/database.js";
import type { ApiListResponse } from "../types/api.js";

/**
 * Rotas de usuários. Protegidas por JWT (em dev, o decorator `authenticate`
 * libera quando AUTH_ENABLED=false).
 */
export async function usuariosRoutes(app: FastifyInstance) {
  // Tipar sempre Params/Body/Reply nos generics.
  app.get<{ Reply: ApiListResponse<UsuarioDetalhado> }>(
    "/usuarios",
    { onRequest: [app.authenticate] }, // rota protegida
    async () => {
      const usuarios = await listUsuarios();
      return { data: usuarios, total: usuarios.length };
    },
  );
}
```

Convenções de rota:
- **Arquivo**: `recurso.routes.ts`; função `recursoRoutes`.
- **Registrar** no `app.ts` (`app.register(recursoRoutes)`).
- **Proteção**: `{ onRequest: [app.authenticate] }` (exceto o que precisa ser público, ex.: stream de imagem via `<img>`).
- **Validação de body**: use JSON Schema no `schema.body` (o Fastify valida antes do handler).
- **Envelope de resposta** (sempre):
  - item único → `{ data: T }` (`ApiResponse<T>`)
  - lista → `{ data: T[], total: number }` (`ApiListResponse<T>`)
  - erro → `reply.code(4xx).send({ message: "..." })`

Exemplo com params, schema e erro:
```typescript
app.patch<{
  Params: { usuarioId: string };
  Body: AtualizarUsuarioInput;
  Reply: ApiResponse<UsuarioDetalhado> | { message: string };
}>(
  "/usuarios/:usuarioId",
  {
    onRequest: [app.authenticate],
    schema: {
      body: {
        type: "object",
        properties: {
          cpf: { type: ["string", "null"] },
          telefone: { type: ["string", "null"] },
        },
        additionalProperties: false,
      },
    },
  },
  async (request, reply) => {
    try {
      const usuario = await atualizarUsuario(request.params.usuarioId, request.body);
      if (!usuario) return reply.code(404).send({ message: "Usuário não encontrado" });
      return { data: usuario };
    } catch (error) {
      // Traduz erro específico do Postgres em status HTTP.
      if ((error as { code?: string }).code === "23505") {
        return reply.code(409).send({ message: "Registro duplicado." });
      }
      throw error; // deixa o Fastify responder 500
    }
  },
);
```

---

## 🗄️ Padrão de ACESSO A DADOS (`lib/database.ts`)

```typescript
import postgres from "postgres";
import { getApiConfig } from "../plugins/env.js";

let _sql: ReturnType<typeof postgres> | null = null;

/** Conexão única (lazy) por campos separados — senha pode ter @ # : sem encoding. */
export function getDatabase() {
  if (!_sql) {
    const { database } = getApiConfig();
    _sql = postgres({
      host: database.host,
      port: database.port,
      database: database.name,
      username: database.user,
      password: database.password,
      max: 10,
    });
  }
  return _sql;
}

/** Funções de acesso: recebem/retornam tipos, usam tagged templates (seguro contra SQL injection). */
export async function getUsuarioPorId(id: string): Promise<UsuarioDetalhado | null> {
  const sql = getDatabase();
  const [row] = await sql<UsuarioRow[]>`
    SELECT u.id, u.nome, u.email
    FROM users u
    WHERE u.id = ${id}
    LIMIT 1
  `;
  return row ?? null;
}
```

Convenções de dados:
- **Sempre tagged template** (`sql\`... ${valor}\``) — nunca concatenar string em SQL.
- **`numeric` do Postgres vem como string** → converta no SELECT (`u.salario::float8`).
- **Datas**: formate no SELECT quando o front espera texto (`to_char(u.data_admissao, 'DD/MM/YYYY')`).
- Funções: `listX`, `getXPorId`, `criarX`, `atualizarX`, `deletarX`. Retornam o tipo (ou `null`).
- **Sem try/catch aqui** — deixa o erro subir; a rota decide o status. (lib = dados puros.)

---

## 🔐 Autenticação

- Token assinado/verificado em `lib/jwt.ts` (HS256, sem libs externas).
- `plugins/auth.ts` é envolvido em **`fastify-plugin`** para que o decorator `app.authenticate` fique visível às rotas irmãs.
- Flag **`AUTH_ENABLED`** (env): quando `false` (dev), o `authenticate` injeta um usuário fictício e libera — permite trabalhar sem SSO/token.
- Proteja rotas com `{ onRequest: [app.authenticate] }`. Rotas consumidas por `<img>`/download ficam **públicas** (a tag não envia header Authorization).

---

## ⚙️ Configuração (`plugins/env.ts`)

- **Nunca** ler `process.env` fora de `env.ts`. Sempre `getApiConfig()`.
- Adicionou variável nova? Coloque no `ApiConfig` (tipo) + no `getApiConfig()` (com fallback via `readEnv`/`readBooleanEnv`) + no `.env`/`.env.example` da **raiz**.

---

## 🧩 Registro no `app.ts`

Toda rota/plugin novo é registrado no `buildApp()`:
```typescript
app.register(authPlugin);          // plugins primeiro (decorators)
app.register(usuariosRoutes);      // depois as rotas
```
Conexões externas (DB/storage) são checadas de forma **resiliente** no hook `onReady` (logam aviso e seguem se estiverem fora), nunca derrubam o boot.

---

## 🗃️ Migrations & Seeds

- **Schema** → `db/migrations/NNN_nome.sql` (numerado, idempotente: `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`).
- **Dados iniciais** → `db/seeds/NNN_seed_nome.sql`.
- Rodar: `psql ... -f db/migrations/NNN_*.sql`. Migrations não rodam sozinhas no boot (são aplicadas manualmente).

---

## ✅ Receita — adicionar um novo recurso (ex.: `ferias`)

1. **Migration** (se precisa de tabela): `db/migrations/NNN_ferias.sql`.
2. **Tipos** de retorno/DTO em `lib/database.ts` (ou `types/`).
3. **Funções de dados** em `lib/database.ts`: `listFerias`, `getFeriasPorId`, `criarFerias`...
4. **Rota** `routes/ferias.routes.ts`: `export async function feriasRoutes(app)` com os endpoints, `onRequest: [app.authenticate]`, `schema` no body, envelope `{ data }`.
5. **Registrar** em `app.ts`: `app.register(feriasRoutes)`.
6. **Env** (se precisar): adicionar em `plugins/env.ts` + `.env`/`.env.example`.
7. **Validar**: `pnpm --filter @erp/api type-check` (ou `npx tsc --noEmit`).

---

## 📌 Boas práticas (OBRIGATÓRIAS)

1. **JSDoc** em toda função/arquivo explicando o propósito.
2. **Imports locais com `.js`** (ESM) e caminhos relativos dentro de `src/`.
3. **Envelope de resposta** consistente (`{ data }` / `{ data, total }` / `{ message }`).
4. **Rota fina**: valida + chama `lib/` + responde. Sem SQL na rota.
5. **`lib/` sem Fastify**: sem `request`/`reply`, sem `try/catch` de HTTP.
6. **SQL sempre parametrizado** (tagged template).
7. **Config só via `getApiConfig()`**.
8. **Erros do Postgres** traduzidos para HTTP na rota (`23505`→409, `23502`→400/422...).
9. **Nunca editar** o schema recriando tabela — crie nova migration.
10. **type-check antes de commitar**.
