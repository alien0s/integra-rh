import postgres from 'postgres';

import { getDatabase } from './database.js';
import {
  buscarFuncionarioLegado,
  type FuncionarioLegado,
} from './mssql.js';

/** Usuário da aplicação, já resolvido com nomes de setor/função. */
export interface AppUser {
  papelCodigo: string | null;
  id: string;
  email: string;
  nome: string;
  avatarUrl: string | null;
  setor: string | null;
  funcao: string | null;
}

/** Dados vindos do Microsoft Graph durante o login SSO. */
export interface MicrosoftProfile {
  email: string;
  nome: string;
  avatarUrl?: string | null;
}

// LEFT JOIN: setor/função podem estar nulos enquanto o RH não preenche.
const SELECT_APP_USER = (sql: ReturnType<typeof postgres>) => sql`
  SELECT u.id,
         u.email,
         u.nome,
         u.avatar_url AS "avatarUrl",
         s.nome       AS setor,
         r.codigo     AS "papelCodigo"
  FROM users u
  LEFT JOIN setor      s ON s.id = u.setor_id
  LEFT JOIN functions  f ON f.id = u.function_id
`;

/**
 * Resolve o usuário autenticado via Microsoft SSO. O login bem-sucedido na
 * Microsoft já é a credencial de confiança.
 * - Se já existe (match por email): atualiza last_login_at, nome e avatar
 *   (nome e avatar vêm sempre do perfil atual da Microsoft).
 * - Se não existe: cria o registro com email, nome e avatar. Os demais campos
 *   (setor, função, data de admissão, etc.) são preenchidos pelo RH depois.
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
    await preencherDadosLegadoSeVazio(user.id, profile.email);

    return { ...user, nome: profile.nome, avatarUrl: profile.avatarUrl ?? null };
  }

  // Primeiro login: cria com email, nome e avatar. RH completa o resto.
  // Papel base COLABORADOR por padrão (RH ajusta depois).
  const [created] = await sql<{ id: string }[]>`
    INSERT INTO users (email, nome, avatar_url, role_id, last_login_at)
    VALUES (
      ${profile.email}, ${profile.nome}, ${profile.avatarUrl ?? null},
      (SELECT id FROM roles WHERE codigo = 'COLABORADOR'), NOW()
    )
    RETURNING id
  `;

  const [user] = await sql<AppUser[]>`
    ${SELECT_APP_USER(sql)}
    WHERE u.id = ${created.id}
  `;

  return user;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Login local por e-mail + senha (temporário, até o Microsoft OAuth existir)
 * ────────────────────────────────────────────────────────────────────────── */

/** Usuário com o hash da senha, para autenticação local. */
export interface AppUserComSenha extends AppUser {
  passwordHash: string | null;
}

/**
 * Busca um usuário pelo e-mail incluindo o hash da senha (login local).
 * Retorna null se o e-mail não existir.
 */
export async function getUsuarioAuthPorEmail(
  email: string,
): Promise<AppUserComSenha | null> {
  const sql = getDatabase();

  const [user] = await sql<AppUserComSenha[]>`
    SELECT u.id,
           u.email,
           u.nome,
           u.avatar_url    AS "avatarUrl",
           s.nome          AS setor,
           f.nome          AS funcao,
           r.codigo        AS "papelCodigo",
           u.password_hash AS "passwordHash"
    FROM users u
    LEFT JOIN setor      s ON s.id = u.setor_id
    LEFT JOIN functions  f ON f.id = u.function_id
    LEFT JOIN roles      r ON r.id = u.role_id
    WHERE u.email = ${email}
  `;

  return user ?? null;
}

/** Define/atualiza o hash da senha de um usuário existente. */
export async function definirSenhaUsuario(
  userId: string,
  passwordHash: string,
): Promise<AppUser | null> {
  const sql = getDatabase();

  const atualizado = await sql`
    UPDATE users
    SET password_hash = ${passwordHash}, last_login_at = NOW()
    WHERE id = ${userId}
  `;

  if (atualizado.count === 0) {
    return null;
  }

  const [user] = await sql<AppUser[]>`
    ${SELECT_APP_USER(sql)}
    WHERE u.id = ${userId}
  `;

  return user;
}

/**
 * Cria um usuário no 1º acesso do login local (e-mail + senha).
 * Enriquecimento: busca o funcionário no banco legado (SQL Server) pelo e-mail
 * e, quando encontrado, usa o nome oficial + CPF + telefone. Se o legado não
 * retornar (desabilitado ou e-mail não encontrado), usa o nome informado na
 * tela. Entidade/setor/função (FKs) ficam para o RH/passo futuro.
 */
/**
 * Reconhece o papel de acesso inicial a partir da função/cargo do funcionário
 * no legado (`legado.funcao`, vindo de v_employee.job_title_name — ver
 * buscarFuncionarioLegado() em mssql.ts).
 *
 * Reconhecimento atual (2026-08-19): só "Presidente", "Tesoureiro" e "Gerente"
 * têm papel próprio; qualquer outra função (ou função ausente/não localizada
 * no legado) cai no papel base COLABORADOR. RH ajusta manualmente depois,
 * se necessário, pela tela de Usuários.
 */
function mapearFuncaoParaPapel(funcao: string | null | undefined): string {
  const normalizado = funcao?.trim().toUpperCase() ?? "";
  if (normalizado.includes("PRESIDENTE")) return "PRESIDENTE";
  if (normalizado.includes("TESOUREIRO")) return "TESOUREIRO";
  if (normalizado.includes("GERENTE")) return "GESTOR";
  return "COLABORADOR";
}

/**
 * Insere um usuário já enriquecido com os dados do banco legado (quando houver).
 * Papel resolvido a partir da função do legado — ver mapearFuncaoParaPapel().
 * Retorna o id criado. `passwordHash` = null no login LDAP/SSO (a credencial
 * não fica aqui).
 *
 * `codigo_aps_entidade` (users): código de matrícula do APS + código da
 * entidade combinados (ex.: "1119164122"), já vem pronto em
 * `legado.codigoApsEntidade` (montado em mssql.ts a partir de
 * v_employee.enrollment_code + v_employee.entity_code).
 * `codigo_aps` (users): o mesmo código de matrícula do APS, isolado (ex.:
 * "1119"), vindo de `legado.codigoAps`.
 * Ambos preenchidos só aqui, no 1º acesso — igual aos demais campos vindos
 * do legado (cpf, telefone, data_admissao, etc.), não são atualizados em
 * logins seguintes.
 */
async function inserirUsuarioComLegado(
  sql: ReturnType<typeof postgres>,
  input: {
    email: string;
    nome: string;
    passwordHash: string | null;
    legado: FuncionarioLegado | null;
  },
): Promise<string> {
  const l = input.legado;
  // Entidade: casa o Cod_Entidade do APS (ex.: "164122") com entities.codigo_aps.
  const entidadeCodigoAps =
    l?.entidade && /^\d{6}$/.test(l.entidade) ? Number(l.entidade) : null;

  const [created] = await sql<{ id: string }[]>`
    INSERT INTO users (
      entity_id, email, nome, cpf, telefone,
      data_admissao, data_nascimento, sexo, estado_civil_id,
      cidade, estado, pis,
      numero_banco, numero_conta, digito_conta,
      password_hash, role_id, last_login_at, codigo_aps_entidade, codigo_aps
    )
    VALUES (
      (SELECT id FROM entities WHERE codigo_aps = ${entidadeCodigoAps} LIMIT 1),
      ${input.email}, ${input.nome}, ${l?.cpf ?? null}, ${l?.telefone ?? null},
      ${l?.dataAdmissao ?? null}, ${l?.dataNascimento ?? null}, ${l?.sexo ?? null},
      (SELECT id FROM estados_civis WHERE codigo = ${l?.estadoCivilCodigo ?? null}),
      ${l?.cidade ?? null}, ${l?.uf ?? null}, ${l?.pis ?? null},
      ${l?.numeroBanco ?? null}, ${l?.numeroConta ?? null}, ${l?.digitoConta ?? null},
      ${input.passwordHash},
      (SELECT id FROM roles WHERE codigo = ${mapearFuncaoParaPapel(l?.funcao)}), NOW(),
      ${l?.codigoApsEntidade ?? null}, ${l?.codigoAps ?? null}
    )
    RETURNING id
  `;
  return created.id;
}

/**
 * Preenche no legado os campos que ainda estiverem vazios (nunca sobrescreve
 * o que já existe — mesmo padrão de `preencherVinculosVazios`). Usado no
 * login de um usuário que JÁ existe em `users` (pré-cadastrado só com
 * email + papel, ex.: gerente indicado manualmente porque a função do APS
 * nem sempre é confiável) e ainda não passou pelo legado.
 *
 * Gatilho: só busca no SQL Server se `codigo_aps` estiver vazio — é o único
 * campo que só é preenchido pelo legado (diferente de cpf/telefone, que o RH
 * também edita manualmente pela tela de Usuários), então serve de marcador
 * confiável de "nunca foi enriquecido". NUNCA mexe em role_id/setor_id/
 * function_id — papel e função são decisão manual do RH, não do legado.
 *
 * `nome` é a única exceção ao "só preenche se vazio": como a coluna é
 * NOT NULL, um usuário pré-cadastrado (ex.: atribuirGerente()) entra com um
 * nome provisório (prefixo do e-mail). Como este bloco só roda uma vez (o
 * gatilho acima nunca deixa rodar de novo), é seguro sobrescrever aqui com o
 * nome oficial do legado.
 */
export async function preencherDadosLegadoSeVazio(
  userId: string,
  email: string,
): Promise<void> {
  const sql = getDatabase();

  const [row] = await sql<{ codigoAps: string | null }[]>`
    SELECT codigo_aps AS "codigoAps" FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!row || row.codigoAps) return;

  const legado = await buscarFuncionarioLegado(email);
  if (!legado) return;

  const entidadeCodigoAps =
    legado.entidade && /^\d{6}$/.test(legado.entidade)
      ? Number(legado.entidade)
      : null;

  await sql`
    UPDATE users SET
      nome                = ${legado.nome},
      entity_id           = COALESCE(entity_id, (SELECT id FROM entities WHERE codigo_aps = ${entidadeCodigoAps} LIMIT 1)),
      cpf                 = COALESCE(cpf, ${legado.cpf ?? null}),
      telefone            = COALESCE(telefone, ${legado.telefone ?? null}),
      data_admissao       = COALESCE(data_admissao, ${legado.dataAdmissao ?? null}),
      data_nascimento     = COALESCE(data_nascimento, ${legado.dataNascimento ?? null}),
      sexo                = COALESCE(sexo, ${legado.sexo ?? null}),
      estado_civil_id     = COALESCE(estado_civil_id, (SELECT id FROM estados_civis WHERE codigo = ${legado.estadoCivilCodigo ?? null})),
      cidade              = COALESCE(cidade, ${legado.cidade ?? null}),
      estado              = COALESCE(estado, ${legado.uf ?? null}),
      pis                 = COALESCE(pis, ${legado.pis ?? null}),
      numero_banco        = COALESCE(numero_banco, ${legado.numeroBanco ?? null}),
      numero_conta        = COALESCE(numero_conta, ${legado.numeroConta ?? null}),
      digito_conta        = COALESCE(digito_conta, ${legado.digitoConta ?? null}),
      codigo_aps          = COALESCE(codigo_aps, ${legado.codigoAps ?? null}),
      codigo_aps_entidade = COALESCE(codigo_aps_entidade, ${legado.codigoApsEntidade ?? null})
    WHERE id = ${userId}
  `;
}

export async function criarUsuarioComSenha(input: {
  email: string;
  nome?: string;
  passwordHash: string;
}): Promise<AppUser> {
  const sql = getDatabase();

  const legado = await buscarFuncionarioLegado(input.email);
  // Nome oficial vem do SQL Server; fallbacks: nome informado (se houver) ou o
  // trecho antes do @ (o RH ajusta depois). users.nome é NOT NULL.
  const nome =
    legado?.nome ?? input.nome ?? input.email.split("@")[0] ?? input.email;

  const id = await inserirUsuarioComLegado(sql, {
    email: input.email,
    nome,
    passwordHash: input.passwordHash,
    legado,
  });

  const [user] = await sql<AppUser[]>`
    ${SELECT_APP_USER(sql)}
    WHERE u.id = ${id}
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

/**
 * Remove o avatar de um usuário (avatar_url = NULL).
 * Retorna o usuário atualizado ou null se o id não existir.
 */
export async function removerAvatarUsuario(userId: string): Promise<AppUser | null> {
  const sql = getDatabase();

  const updated = await sql`
    UPDATE users SET avatar_url = NULL WHERE id = ${userId}
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
 * setor, função e gestor resolvidos via JOIN. Campos opcionais podem
 * estar nulos enquanto o RH não preenche.
 */
export interface UsuarioDetalhado {
  id: string;
  nome: string;
  email: string;
  funcao: string;
  setor: string;
  entidade: string | null;
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
  /** Papel/perfil de acesso (código, ex.: "ADMIN") — único por usuário. */
  papelCodigo: string | null;
  /** Nome do papel para exibição (ex.: "Administrador do sistema"). */
  papel: string | null;
  /** Data de nascimento "DD/MM/AAAA". */
  dataNascimento: string | null;
  /** Sexo: 1 = masculino, 0 = feminino. */
  sexo: number | null;
  /** Estado civil (nome, ex.: "Solteiro(a)"). */
  estadoCivil: string | null;
  cidade: string | null;
  /** UF (2 letras). */
  estado: string | null;
  pis: string | null;
  /** Código do banco (3 dígitos). */
  numeroBanco: string | null;
  numeroConta: string | null;
  digitoConta: string | null;
  /** Código de matrícula do funcionário no APS (enrollment_code), ex.: "1119". */
  codigoAps: string | null;
  /** Código APS + código da entidade combinados, ex.: "1119164122". */
  codigoApsEntidade: string | null;
  /** Tipo de vínculo (CLT): "COLABORADOR" (padrão) ou "APRENDIZ/ESTAGIÁRIO". */
  tipoFuncionario: string;
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
 * SELECT base dos usuários com JOINs (setor, função e gestor).
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
    COALESCE(s.nome, '')                              AS setor,
    en.nome                                            AS entidade,
    CASE WHEN u.is_active THEN 'Ativo' ELSE 'Inativo' END AS status,
    COALESCE(u.avatar_url, '')                        AS "fotoUrl",
    u.telefone,
    u.cpf,
    u.salario::float8                                 AS salario,
    to_char(u.data_admissao, 'DD/MM/YYYY')            AS "dataAdmissao",
    to_char(u.data_demissao, 'DD/MM/YYYY')            AS "dataDemissao",
    m.nome                                            AS gestor,
    to_char(u.last_login_at, 'DD/MM/YYYY HH24:MI')    AS "ultimoAcesso",
    r.codigo                                          AS "papelCodigo",
    r.nome                                            AS papel,
    to_char(u.data_nascimento, 'DD/MM/YYYY')          AS "dataNascimento",
    u.sexo                                            AS sexo,
    ec.nome                                           AS "estadoCivil",
    u.cidade,
    u.estado,
    u.pis,
    u.numero_banco                                    AS "numeroBanco",
    u.numero_conta                                    AS "numeroConta",
    u.digito_conta                                    AS "digitoConta",
    u.codigo_aps                                      AS "codigoAps",
    u.codigo_aps_entidade                             AS "codigoApsEntidade",
    u.tipo_funcionario                                AS "tipoFuncionario"
  FROM users u
  LEFT JOIN setor         s  ON s.id = u.setor_id
  LEFT JOIN entities      en ON en.id = u.entity_id
  LEFT JOIN functions     f  ON f.id = u.function_id
  LEFT JOIN users         m  ON m.id = u.manager_id
  LEFT JOIN roles         r  ON r.id = u.role_id
  LEFT JOIN estados_civis ec ON ec.id = u.estado_civil_id
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

/** Opção genérica id/nome para dropdowns (setores, funções). */
export interface OpcaoSelecao {
  id: string;
  nome: string;
  /** Só nos setores: nome do gestor atual (para avisar antes de substituir). */
  gestorNome?: string | null;
}

/** Lista de setores (para o dropdown de edição) + gestor atual de cada um. */
export async function listSetores(): Promise<OpcaoSelecao[]> {
  const sql = getDatabase();
  return sql<OpcaoSelecao[]>`
    SELECT s.id, s.nome, g.nome AS "gestorNome"
    FROM setor s
    LEFT JOIN users g ON g.id = s.gestor_id
    ORDER BY s.nome
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
  setorId: string | null;
  entidadeId: string | null;
  funcaoId: string | null;
  /** Código do papel/perfil de acesso (ex.: "ADMIN") ou null. */
  roleCodigo: string | null;
  /** Tipo de vínculo (CLT): "COLABORADOR" ou "APRENDIZ/ESTAGIÁRIO". Omitido = mantém o atual. */
  tipoFuncionario?: string;
}

/** Resolve o id do papel a partir do código (ou null). */
async function resolverRoleId(
  sql: ReturnType<typeof postgres>,
  roleCodigo: string | null,
): Promise<string | null> {
  if (!roleCodigo) return null;
  const [role] = await sql<{ id: string }[]>`
    SELECT id FROM roles WHERE codigo = ${roleCodigo} LIMIT 1
  `;
  return role?.id ?? null;
}

/**
 * Atualiza os campos editáveis de um usuário (cpf, telefone, setor,
 * função e papel). Retorna o usuário atualizado ou null se não existir.
 *
 * `participa_vr` é recalculado automaticamente aqui, com base no setor/
 * função que ESTÃO SENDO SALVOS agora (não os antigos) — assim, mover
 * alguém pra Setor Distrital + Pastor Distrital (ou tirar de lá) já
 * atualiza a participação no VR na hora, sem precisar rodar SQL manual
 * de novo (ver migration 019_users_participa_vr.sql pro ajuste inicial).
 */
export async function atualizarUsuario(
  id: string,
  input: AtualizarUsuarioInput,
): Promise<UsuarioDetalhado | null> {
  const sql = getDatabase();

  const roleId = await resolverRoleId(sql, input.roleCodigo);

  const updated = await sql`
    UPDATE users SET
      cpf           = ${input.cpf},
      entity_id     = ${input.entidadeId},
      telefone      = ${input.telefone},
      setor_id      = ${input.setorId},
      function_id   = ${input.funcaoId},
      role_id       = ${roleId},
      tipo_funcionario = COALESCE(${input.tipoFuncionario ?? null}, tipo_funcionario),
      participa_vr  = NOT (
        COALESCE((SELECT nome FROM setor WHERE id = ${input.setorId}), '') = 'Distrital'
        AND COALESCE((SELECT nome FROM functions WHERE id = ${input.funcaoId}), '') = 'Pastor Distrital'
      )
    WHERE id = ${id}
  `;

  if (updated.count === 0) {
    return null;
  }

  return getUsuarioPorId(id);
}

/** Exclui um usuário. Retorna false se o id não existir. */
export async function excluirUsuario(id: string): Promise<boolean> {
  const sql = getDatabase();
  const deleted = await sql`DELETE FROM users WHERE id = ${id}`;
  return deleted.count > 0;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Importação de usuários (planilha CSV/Excel)
 * ────────────────────────────────────────────────────────────────────────── */

/** Retorna o id do usuário com esse e-mail, ou null. */
export async function getUsuarioIdPorEmail(
  email: string,
): Promise<string | null> {
  const sql = getDatabase();
  const [u] = await sql<{ id: string }[]>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  return u?.id ?? null;
}

/**
 * Preenche entidade/setor de um usuário SÓ quando estão vazios (não
 * sobrescreve valores já definidos). Retorna true se algo foi preenchido.
 * Usado na reimportação para completar quem já existe.
 */
export async function preencherVinculosVazios(
  id: string,
  input: { entityId: string | null; setorId: string | null },
): Promise<boolean> {
  const sql = getDatabase();
  const updated = await sql`
    UPDATE users SET
      entity_id = COALESCE(entity_id, ${input.entityId}),
      setor_id  = COALESCE(setor_id, ${input.setorId})
    WHERE id = ${id}
      AND (
        (entity_id IS NULL AND ${input.entityId}::uuid IS NOT NULL)
        OR (setor_id IS NULL AND ${input.setorId}::uuid IS NOT NULL)
      )
  `;
  return updated.count > 0;
}

/**
 * Resolve a entidade a partir de uma referência da planilha: código APS
 * (6 dígitos) ou nome (case-insensitive). Retorna o id ou null.
 */
export async function resolverEntidadePorReferencia(
  ref: string,
): Promise<string | null> {
  const sql = getDatabase();
  const limpo = ref.trim();

  if (/^\d{6}$/.test(limpo)) {
    const [porAps] = await sql<{ id: string }[]>`
      SELECT id FROM entities WHERE codigo_aps = ${Number(limpo)} LIMIT 1
    `;
    if (porAps) return porAps.id;
  }

  const [porNome] = await sql<{ id: string }[]>`
    SELECT id FROM entities WHERE lower(nome) = lower(${limpo}) LIMIT 1
  `;
  return porNome?.id ?? null;
}

/** Setor para casamento por nome na importação. */
export interface SetorParaMatch {
  id: string;
  nome: string;
}

/** Lista (id, nome) dos setores, para casar por nome na importação. */
export async function listSetoresParaMatch(): Promise<SetorParaMatch[]> {
  const sql = getDatabase();
  return sql<SetorParaMatch[]>`
    SELECT id, nome FROM setor ORDER BY nome
  `;
}

/**
 * Cria um usuário vindo de importação (planilha): e-mail, nome, entidade e
 * setor (quando casaram); papel base COLABORADOR. Os demais dados vêm
 * do APS no 1º login.
 */
export async function criarUsuarioImportado(input: {
  email: string;
  nome: string;
  entityId: string | null;
  setorId: string | null;
}): Promise<void> {
  const sql = getDatabase();
  await sql`
    INSERT INTO users (entity_id, setor_id, email, nome, role_id)
    VALUES (
      ${input.entityId}, ${input.setorId}, ${input.email}, ${input.nome},
      (SELECT id FROM roles WHERE codigo = 'COLABORADOR')
    )
  `;
}

/**
 * Atribui alguém como gerente (papel GESTOR) de um setor, a partir do e-mail.
 * Se o e-mail já existe em `users`: só atualiza setor_id + role_id (não mexe
 * no resto do cadastro, nem na entidade). Se não existe: cria um registro
 * mínimo — email, nome provisório (prefixo do e-mail, mesmo fallback usado
 * em criarUsuarioComSenha/findOrCreateUsuarioLocal), setor, papel GESTOR e
 * a MESMA ENTIDADE de quem está criando (`criadoPorUserId`, o usuário
 * autenticado na rota). Os demais dados (cpf, telefone, nome oficial, etc.)
 * são preenchidos pelo APS no 1º login dessa pessoa, via
 * preencherDadosLegadoSeVazio() — que também corrige esse nome provisório.
 *
 * Existe para NÃO depender só da função vinda do legado (job_title_name),
 * que nem sempre indica corretamente quem é gerente — ver mapearFuncaoParaPapel.
 */
export async function atribuirGerente(input: {
  email: string;
  setorId: string;
  criadoPorUserId: string;
}): Promise<UsuarioDetalhado> {
  const sql = getDatabase();

  const existenteId = await getUsuarioIdPorEmail(input.email);

  if (existenteId) {
    await sql`
      UPDATE users SET
        setor_id = ${input.setorId},
        role_id  = (SELECT id FROM roles WHERE codigo = 'GESTOR')
      WHERE id = ${existenteId}
    `;
    // Registra também quem é o gestor DO setor (usado pelo fluxo de férias
    // para rotear a 1ª etapa de aprovação — setor.gestor_id é a fonte da verdade).
    await sql`UPDATE setor SET gestor_id = ${existenteId} WHERE id = ${input.setorId}`;
    return (await getUsuarioPorId(existenteId))!;
  }

  const [created] = await sql<{ id: string }[]>`
    INSERT INTO users (email, nome, setor_id, role_id, entity_id)
    VALUES (
      ${input.email},
      ${input.email.split("@")[0]},
      ${input.setorId},
      (SELECT id FROM roles WHERE codigo = 'GESTOR'),
      (SELECT entity_id FROM users WHERE id = ${input.criadoPorUserId})
    )
    RETURNING id
  `;
  await sql`UPDATE setor SET gestor_id = ${created.id} WHERE id = ${input.setorId}`;
  return (await getUsuarioPorId(created.id))!;
}

/**
 * Resolve o usuário local após um login bem-sucedido no LDAP (Microsoft AD).
 * Se já existe (por e-mail): atualiza last_login_at e retorna. Se não existe:
 * cria o registro enriquecendo com o banco legado (nome/cpf/telefone/admissão).
 * A senha NÃO é armazenada — a credencial fica no AD.
 */
export async function findOrCreateUsuarioLocal(email: string): Promise<AppUser> {
  const sql = getDatabase();

  const existente = await getUsuarioAuthPorEmail(email);
  if (existente) {
    await sql`UPDATE users SET last_login_at = NOW() WHERE id = ${existente.id}`;
    await preencherDadosLegadoSeVazio(existente.id, email);
    return {
      id: existente.id,
      email: existente.email,
      nome: existente.nome,
      avatarUrl: existente.avatarUrl,
      setor: existente.setor,
      funcao: existente.funcao,
      papelCodigo: existente.papelCodigo,
    };
  }

  const legado = await buscarFuncionarioLegado(email);
  const nome = legado?.nome ?? email.split("@")[0] ?? email;

  const id = await inserirUsuarioComLegado(sql, {
    email,
    nome,
    passwordHash: null,
    legado,
  });

  const [user] = await sql<AppUser[]>`
    ${SELECT_APP_USER(sql)}
    WHERE u.id = ${id}
  `;

  return user;
}

/**
 * Atualização do próprio perfil (self-service): mexe SÓ em cpf e telefone.
 * Não toca em setor/função/papéis — diferente de atualizarUsuario (RH).
 */
export async function atualizarPerfilProprio(
  id: string,
  input: { cpf: string | null; telefone: string | null },
): Promise<UsuarioDetalhado | null> {
  const sql = getDatabase();

  const updated = await sql`
    UPDATE users SET cpf = ${input.cpf}, telefone = ${input.telefone}
    WHERE id = ${id}
  `;

  if (updated.count === 0) {
    return null;
  }

  return getUsuarioPorId(id);
}