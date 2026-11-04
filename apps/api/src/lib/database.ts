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

/**
 * Callbacks "pós-commit" da transação `rodaComoUsuario` atual, quando existir
 * (ver `aposCommit` e `rodaComoUsuario` abaixo). Guardado à parte de
 * `contextoRequisicao`: o array é criado 1x por `rodaComoUsuario` e
 * continua acessível dentro de um `comSavepoint` aninhado (que só troca o
 * contexto de `contextoRequisicao`, nunca este) — um efeito registrado
 * dentro de um savepoint também só deve disparar se a transação PRINCIPAL
 * realmente commitar.
 */
const callbacksPosCommit = new AsyncLocalStorage<(() => void)[]>();

/**
 * Registra `fn` para rodar só DEPOIS que a transação `rodaComoUsuario` atual
 * tiver COMMITADO de verdade — nunca antes. Existe pra evitar a race de
 * "avisar antes de commitar": ex.: o push SSE de notificação (ver
 * `notificarClientes` em `notificacoesStream.ts`, chamado pelos `emitir*` de
 * `notificacoes.ts`) chegava no cliente, que já refazia o `GET /notificacoes`
 * — mas se isso acontecesse ANTES do commit, a leitura (em outra conexão/
 * transação) ainda não via a linha recém-inserida (MVCC do Postgres), e a
 * notificação só aparecia depois, num recarregar manual da página.
 *
 * Fora de uma transação `rodaComoUsuario` (não deveria acontecer nos
 * call-sites atuais de `emitir*` — todos rodam dentro de uma — mas serve de
 * rede de segurança), roda `fn` na hora: não há commit nenhum a esperar.
 */
export function aposCommit(fn: () => void): void {
  const lista = callbacksPosCommit.getStore();
  if (lista) {
    lista.push(fn);
  } else {
    fn();
  }
}

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
 *
 * Depois que a transação commita de verdade, dispara os callbacks
 * registrados por `aposCommit` durante `fn` (ex.: o push SSE de uma
 * notificação criada ali dentro) — nunca antes, pra quem receber o push e
 * reconsultar a API já encontrar os dados. Se `fn` lançar (ROLLBACK), os
 * callbacks NUNCA rodam — o que seria avisado não chegou a existir de verdade.
 */
export async function rodaComoUsuario<T>(
  usuario: { id: string; papelCodigo?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const sql = getDatabase();
  const callbacks: (() => void)[] = [];

  const resultado = (await sql.begin(async (tx) => {
    await setarIdentidadeNaTransacao(tx, usuario);
    return contextoRequisicao.run(tx, () => callbacksPosCommit.run(callbacks, fn));
  })) as T;

  for (const callback of callbacks) {
    try {
      callback();
    } catch (error) {
      console.error('[database] falha num callback pós-commit:', error);
    }
  }

  return resultado;
}

/**
 * Roda `fn` dentro de um SAVEPOINT da transação da requisição atual — se `fn`
 * lançar, só esse trecho é desfeito (ROLLBACK TO SAVEPOINT); a transação
 * principal continua saudável e o restante do request (inclusive o COMMIT
 * final) segue normalmente. Sem isso, QUALQUER erro de SQL dentro de `fn`
 * deixa a transação inteira "abortada" no Postgres (todo comando seguinte
 * falha com 25P02, "current transaction is aborted") MESMO que `fn` já tenha
 * o próprio try/catch — um try/catch em JS evita a exceção subir, mas não
 * desfaz o estado abortado da transação no banco (foi exatamente o que
 * aconteceu no login: sincronizarFeriasLegado engoliu um 23505 real, mas a
 * chamada seguinte, sincronizarQualificacoesLegado, caiu num 25P02 por causa
 * disso, e o login inteiro quebrou).
 *
 * Use em qualquer enriquecimento "best effort" dentro do login (ex.:
 * sincronizarDadosLegado/sincronizarFeriasLegado/
 * sincronizarQualificacoesLegado em usuarios.ts) — o próprio helper já loga
 * e engole o erro, então essas funções não precisam (e não devem) duplicar
 * esse try/catch pensando que isso já as protege da transação externa.
 *
 * Sem transação ambiente (`contextoRequisicao` vazio — não deveria acontecer
 * nos call-sites atuais, todos dentro de `rodaComoUsuario`), roda `fn` direto.
 */
export async function comSavepoint<T>(fn: () => Promise<T>): Promise<T | undefined> {
  const tx = contextoRequisicao.getStore();
  if (!tx) return fn();

  try {
    return (await tx.savepoint(async (sp) => await contextoRequisicao.run(sp, fn))) as T;
  } catch (error) {
    console.error('[database] falha isolada num savepoint (transação principal preservada):', error);
    return undefined;
  }
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
