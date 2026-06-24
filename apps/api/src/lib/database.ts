import postgres from 'postgres';

import { getApiConfig } from '../plugins/env.js';

let _sql: ReturnType<typeof postgres> | null = null;

export function getDatabase() {
  if (!_sql) {
    const config = getApiConfig();
    _sql = postgres(config.database.url, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    });
  }
  return _sql;
}

export interface OAuthUser {
  id: string;
  microsoft_id: string;
  email: string;
  nome: string;
  avatar?: string | null;
  departamento?: string | null;
  funcao?: string | null;
}

export async function runMigrations() {
  const sql = getDatabase();

  await sql`
    CREATE TABLE IF NOT EXISTS oauth_users (
      id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      microsoft_id VARCHAR(255) UNIQUE NOT NULL,
      email        VARCHAR(255) UNIQUE NOT NULL,
      nome         VARCHAR(255) NOT NULL,
      avatar       TEXT,
      departamento VARCHAR(255),
      funcao       VARCHAR(255),
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
}

export async function upsertOAuthUser(
  data: Omit<OAuthUser, 'id'>,
): Promise<OAuthUser> {
  const sql = getDatabase();

  const [user] = await sql<OAuthUser[]>`
    INSERT INTO oauth_users (microsoft_id, email, nome, avatar, departamento, funcao)
    VALUES (
      ${data.microsoft_id},
      ${data.email},
      ${data.nome},
      ${data.avatar ?? null},
      ${data.departamento ?? null},
      ${data.funcao ?? null}
    )
    ON CONFLICT (microsoft_id) DO UPDATE SET
      email        = EXCLUDED.email,
      nome         = EXCLUDED.nome,
      avatar       = EXCLUDED.avatar,
      departamento = EXCLUDED.departamento,
      funcao       = EXCLUDED.funcao,
      updated_at   = NOW()
    RETURNING id, microsoft_id, email, nome, avatar, departamento, funcao
  `;

  return user;
}
