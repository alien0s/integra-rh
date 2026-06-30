import postgres from 'postgres';

import { getApiConfig } from '../plugins/env.js';

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

/** Usuário da aplicação, já resolvido com nomes de departamento/função. */
export interface AppUser {
  id: string;
  email: string;
  nome: string;
  avatarUrl: string | null;
  departamento: string | null;
  funcao: string | null;
}

/** Dados vindos do Microsoft Graph durante o login SSO. */
export interface MicrosoftProfile {
  email: string;
  nome: string;
  avatarUrl?: string | null;
}

// LEFT JOIN: departamento/função podem estar nulos enquanto o RH não preenche.
const SELECT_APP_USER = (sql: ReturnType<typeof postgres>) => sql`
  SELECT u.id,
         u.email,
         u.nome,
         u.avatar_url AS "avatarUrl",
         d.nome       AS departamento,
         f.nome       AS funcao
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN functions  f ON f.id = u.function_id
`;

/**
 * Resolve o usuário autenticado via Microsoft SSO. O login bem-sucedido na
 * Microsoft já é a credencial de confiança.
 * - Se já existe (match por email): atualiza last_login_at, nome e avatar
 *   (nome e avatar vêm sempre do perfil atual da Microsoft).
 * - Se não existe: cria o registro com email, nome e avatar. Os demais campos
 *   (departamento, função, data de admissão, etc.) são preenchidos pelo RH depois.
 */
export async function findOrCreateUser(profile: MicrosoftProfile): Promise<AppUser> {
  const sql = getDatabase();

  const existing = await sql<AppUser[]>`
    ${SELECT_APP_USER(sql)}
    WHERE u.email = ${profile.email}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const user = existing[0];

    await sql`
      UPDATE users
      SET last_login_at = NOW(),
          nome          = ${profile.nome},
          avatar_url    = ${profile.avatarUrl ?? null}
      WHERE id = ${user.id}
    `;

    return { ...user, nome: profile.nome, avatarUrl: profile.avatarUrl ?? null };
  }

  // Primeiro login: cria com email, nome e avatar. RH completa o resto.
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO users (email, nome, avatar_url, last_login_at)
    VALUES (${profile.email}, ${profile.nome}, ${profile.avatarUrl ?? null}, NOW())
    RETURNING id
  `;

  const [user] = await sql<AppUser[]>`
    ${SELECT_APP_USER(sql)}
    WHERE u.id = ${created.id}
  `;

  return user;
}
