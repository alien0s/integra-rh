import { AsyncLocalStorage } from 'node:async_hooks';

import postgres, { type TransactionSql } from 'postgres';

import { getApiConfig } from '../plugins/env.js';

/**
 * Cliente PostgreSQL (conexão única, lazy). Ponto central usado por toda a
 * camada `lib/` — cada domínio (usuários, férias, notificações, vale-refeição,
 * tabelas...) tem seu próprio arquivo em `lib/` e importa `getDatabase()`
 * daqui em vez de duplicar a conexão. Ver `lib/usuarios.ts`, `lib/ferias.ts`,
 * `lib/notificacoes.ts`, `lib/vr.services.ts`, `lib/tabelas.ts`.
 */

let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Transação da requisição atual (ver `rodaComoUsuario`), quando existir.
 * Usa AsyncLocalStorage pra propagar implicitamente por toda a cadeia de
 * `await` — os arquivos de `lib/` continuam só chamando `getDatabase()`
 * normalmente, sem saber que às vezes estão "dentro" de uma transação com
 * identidade (RLS — ver a seção de Row Level Security no final de
 * db/migrations/008_ferias.sql, 013_qualificacoes.sql, etc.).
 *
 * Guardamos como `TransactionSql`, mas `getDatabase()` continua devolvendo
 * o tipo público de sempre (`ReturnType<typeof postgres>`) — de propósito,
 * pra não mudar o tipo em TODO outro arquivo de `lib/` que já chama
 * `getDatabase()` hoje (ex.: `vr.service.ts` usa `.begin()` pra suas
 * próprias transações, método que não existe em `TransactionSql`). Na
 * prática, um `TransactionSql` suporta exatamente a mesma sintaxe de
 * template (`` sql`...` ``) usada em `ferias.ts`/`notificacoes.ts` — só os
 * métodos administrativos (`.begin()`, `.end()`, etc.), que esses dois
 * arquivos não chamam, é que diferem.
 */
const contextoRequisicao = new AsyncLocalStorage<TransactionSql>();

export function getDatabase(): ReturnType<typeof postgres> {
  const daRequisicao = contextoRequisicao.getStore();
  if (daRequisicao) return daRequisicao as unknown as ReturnType<typeof postgres>;

  if (!_sql) {
    const config = getApiConfig();
    // Conexão por campos separados (não usa connection string), então a senha
    // pode conter caracteres especiais (@, #, :) sem precisar de URL-encoding.
    _sql = postgres({
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      username: config.database.user,
      password: config.database.password,
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }
  return _sql;
}

/**
 * Seta `app.user_id`/`app.papel` NA TRANSAÇÃO `tx` já aberta, via
 * `set_config(..., true)` (o `true` = local à transação, "SET LOCAL"
 * parametrizado — `SET LOCAL` puro não aceita bind parameter pro valor). As
 * policies de RLS leem esses dois valores com
 * `current_setting('app.user_id'/'app.papel', true)`.
 *
 * `papelCodigo` undefined (auth desativada / modo dev) vira 'ADMIN' pra RLS
 * — mesma convenção já usada em `exigirPapeis`/`bloquearColaborador`
 * (`plugins/auth.ts`): "papel undefined também passa".
 *
 * Uso direto (em vez de `rodaComoUsuario`) só quando o código já abre a
 * PRÓPRIA transação via `sql.begin()` — ex.: `criarVrMes`/`editarVrMes`/
 * `criarLancamentosEmLote`/`fecharVrPorEntidade` em `vr.service.ts`, que
 * precisam de uma transação única pra atomicidade do fechamento/lançamento
 * em lote. Não dá pra usar `rodaComoUsuario` ali porque ele TAMBÉM abre uma
 * transação (`sql.begin()`) — chamar `.begin()` de novo dentro dela não
 * funciona (`TransactionSql` não tem `.begin()`, só `.savepoint()`). Por
 * isso essas 4 funções chamam `setarIdentidadeNaTransacao(sql, usuario)`
 * como a 1ª linha do próprio `sql.begin(async (sql) => { ... })` delas.
 */
export async function setarIdentidadeNaTransacao(
  tx: TransactionSql,
  usuario: { id: string; papelCodigo?: string },
): Promise<void> {
  await tx`SELECT set_config('app.user_id', ${usuario.id}, true)`;
  await tx`SELECT set_config('app.papel', ${usuario.papelCodigo ?? 'ADMIN'}, true)`;
}

/**
 * Roda `fn` dentro de uma NOVA transação com `app.user_id`/`app.papel` já
 * setados (ver `setarIdentidadeNaTransacao`). Qualquer `getDatabase()`
 * chamado (direta ou indiretamente) dentro de `fn` passa a devolver esta
 * transação automaticamente — ver `contextoRequisicao` acima. Usar nas
 * rotas que tocam tabelas com RLS ligado e que NÃO abrem a própria
 * transação internamente (a maioria) — ex.: cada handler de
 * `ferias.routes.ts`/`qualificacoes.routes.ts`, e a leitura de
 * `GET /notificacoes` (faz JOIN com tabelas de RLS pra saber se uma
 * notificação ainda está acionável).
 */
export async function rodaComoUsuario<T>(
  usuario: { id: string; papelCodigo?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    await setarIdentidadeNaTransacao(tx, usuario);
    return contextoRequisicao.run(tx, fn);
  }) as Promise<T>;
}

/**
 * Testa a conexão com o PostgreSQL. As migrações de schema são gerenciadas
 * manualmente pelos arquivos em db/migrations/, então aqui só validamos
 * que o banco está acessível no boot da API.
 */
export async function checkDatabaseConnection() {
  const sql = getDatabase();
  await sql`SELECT 1`;
}
