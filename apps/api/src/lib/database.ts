import postgres from 'postgres';

import { getApiConfig } from '../plugins/env.js';

/**
 * Cliente PostgreSQL (conexão única, lazy). Ponto central usado por toda a
 * camada `lib/` — cada domínio (usuários, férias, notificações, vale-refeição,
 * tabelas...) tem seu próprio arquivo em `lib/` e importa `getDatabase()`
 * daqui em vez de duplicar a conexão. Ver `lib/usuarios.ts`, `lib/ferias.ts`,
 * `lib/notificacoes.ts`, `lib/vr.services.ts`, `lib/tabelas.ts`.
 */

let _sql: ReturnType<typeof postgres> | null = null;

export function getDatabase() {
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
 * Testa a conexão com o PostgreSQL. As migrações de schema são gerenciadas
 * manualmente pelos arquivos em db/migrations/, então aqui só validamos
 * que o banco está acessível no boot da API.
 */
export async function checkDatabaseConnection() {
  const sql = getDatabase();
  await sql`SELECT 1`;
}
