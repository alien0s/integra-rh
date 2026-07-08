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

/**
 * Atualiza o avatar (chave do objeto no storage) de um usuário.
 * Retorna o usuário atualizado ou null se o id não existir.
 */
export async function updateUserAvatar(
  userId: string,
  avatarUrl: string,
): Promise<AppUser | null> {
  const sql = getDatabase();

  const updated = await sql`
    UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${userId}
  `;

  if (updated.count === 0) {
    return null;
  }

  const [user] = await sql<AppUser[]>`
    ${SELECT_APP_USER(sql)}
    WHERE u.id = ${userId}
  `;

  return user;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Listagem de usuários (consumida pela tela de Usuários do front)
 * ────────────────────────────────────────────────────────────────────────── */

/**
 * Usuário com os dados completos para a listagem/perfil, já com os nomes de
 * departamento, função e gestor resolvidos via JOIN. Campos opcionais podem
 * estar nulos enquanto o RH não preenche.
 */
export interface UsuarioDetalhado {
  id: string;
  nome: string;
  email: string;
  funcao: string;
  departamento: string;
  status: "Ativo" | "Inativo";
  fotoUrl: string;
  iniciais: string;
  telefone: string | null;
  cpf: string | null;
  salario: number | null;
  dataAdmissao: string | null;
  dataDemissao: string | null;
  gestor: string | null;
  ultimoAcesso: string | null;
}

/** Linha crua retornada pela query (sem as iniciais, derivadas no JS). */
type UsuarioRow = Omit<UsuarioDetalhado, "iniciais">;

/** Deriva as iniciais (primeiro + último nome) para o fallback do avatar. */
function gerarIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return `${primeira}${ultima}`.toUpperCase();
}

/**
 * Converte o valor de `avatar_url` numa URL exibível pelo front:
 * - vazio                     → "" (front usa o fallback com iniciais)
 * - data URI / URL http(s)    → usado como está (foto do Microsoft Graph)
 * - chave do storage (upload) → caminho da API que faz stream do objeto
 *   (`/usuarios/:id/avatar`), servido pela própria API — o navegador nunca
 *   acessa o MinIO direto. O front prefixa com a base "/api".
 */
function montarAvatarUrl(id: string, valor: string): string {
  if (!valor) return "";
  if (valor.startsWith("http") || valor.startsWith("data:")) {
    return valor;
  }
  return `/usuarios/${id}/avatar`;
}

/**
 * Lê a chave (key) do avatar de um usuário no storage. Usado pela rota que
 * faz stream da imagem. Retorna null se o usuário não tem avatar de storage.
 */
export async function getUsuarioAvatarKey(id: string): Promise<string | null> {
  const sql = getDatabase();
  const [row] = await sql<{ avatar_url: string | null }[]>`
    SELECT avatar_url FROM users WHERE id = ${id} LIMIT 1
  `;

  const valor = row?.avatar_url;
  // Só é "chave de storage" se não for data URI / URL http.
  if (!valor || valor.startsWith("http") || valor.startsWith("data:")) {
    return null;
  }
  return valor;
}

/**
 * SELECT base dos usuários com JOINs (departamento, função e gestor).
 * Datas e salário já vêm formatados/convertidos para o formato do front:
 * - datas: "DD/MM/AAAA" (e "DD/MM/AAAA HH:MI" no último acesso)
 * - salário: float (numeric do Postgres viria como string)
 * - status: derivado de is_active
 */
const SELECT_USUARIO_DETALHADO = (sql: ReturnType<typeof postgres>) => sql`
  SELECT
    u.id,
    u.nome,
    u.email,
    COALESCE(f.nome, '')                              AS funcao,
    COALESCE(d.nome, '')                              AS departamento,
    CASE WHEN u.is_active THEN 'Ativo' ELSE 'Inativo' END AS status,
    COALESCE(u.avatar_url, '')                        AS "fotoUrl",
    u.telefone,
    u.cpf,
    u.salario::float8                                 AS salario,
    to_char(u.data_admissao, 'DD/MM/YYYY')            AS "dataAdmissao",
    to_char(u.data_demissao, 'DD/MM/YYYY')            AS "dataDemissao",
    m.nome                                            AS gestor,
    to_char(u.last_login_at, 'DD/MM/YYYY HH24:MI')    AS "ultimoAcesso"
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN functions  f ON f.id = u.function_id
  LEFT JOIN users      m ON m.id = u.manager_id
`;

/**
 * Lista todos os usuários cadastrados, ordenados por nome.
 */
export async function listUsuarios(): Promise<UsuarioDetalhado[]> {
  const sql = getDatabase();

  const rows = await sql<UsuarioRow[]>`
    ${SELECT_USUARIO_DETALHADO(sql)}
    ORDER BY u.nome
  `;

  return rows.map((row) => ({
    ...row,
    fotoUrl: montarAvatarUrl(row.id, row.fotoUrl),
    iniciais: gerarIniciais(row.nome),
  }));
}

/**
 * Busca um usuário pelo id. Retorna null se não existir.
 */
export async function getUsuarioPorId(
  id: string,
): Promise<UsuarioDetalhado | null> {
  const sql = getDatabase();

  const [row] = await sql<UsuarioRow[]>`
    ${SELECT_USUARIO_DETALHADO(sql)}
    WHERE u.id = ${id}
    LIMIT 1
  `;

  if (!row) {
    return null;
  }

  return {
    ...row,
    fotoUrl: montarAvatarUrl(row.id, row.fotoUrl),
    iniciais: gerarIniciais(row.nome),
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Edição de usuário (modal) — listas de opções e update
 * ────────────────────────────────────────────────────────────────────────── */

/** Opção genérica id/nome para dropdowns (departamentos, funções). */
export interface OpcaoSelecao {
  id: string;
  nome: string;
}

/** Lista de departamentos (para o dropdown de edição). */
export async function listDepartamentos(): Promise<OpcaoSelecao[]> {
  const sql = getDatabase();
  return sql<OpcaoSelecao[]>`
    SELECT id, nome FROM departments ORDER BY nome
  `;
}

/** Lista de funções (para o dropdown de edição). */
export async function listFuncoes(): Promise<OpcaoSelecao[]> {
  const sql = getDatabase();
  return sql<OpcaoSelecao[]>`
    SELECT id, nome FROM functions ORDER BY nome
  `;
}

/** Campos editáveis de um usuário. */
export interface AtualizarUsuarioInput {
  cpf: string | null;
  telefone: string | null;
  departamentoId: string | null;
  funcaoId: string | null;
}

/**
 * Atualiza os campos editáveis de um usuário (cpf, telefone, departamento e
 * função) e retorna o usuário atualizado. Retorna null se o id não existir.
 */
export async function atualizarUsuario(
  id: string,
  input: AtualizarUsuarioInput,
): Promise<UsuarioDetalhado | null> {
  const sql = getDatabase();

  const updated = await sql`
    UPDATE users SET
      cpf           = ${input.cpf},
      telefone      = ${input.telefone},
      department_id = ${input.departamentoId},
      function_id   = ${input.funcaoId}
    WHERE id = ${id}
  `;

  if (updated.count === 0) {
    return null;
  }

  return getUsuarioPorId(id);
}
