-- 006_users.sql
-- Tabela central de usuários do ERP.
-- Login: LDAP/AD (principal), Microsoft OAuth (SSO) ou senha local (password_hash).
-- Papel de acesso ÚNICO via role_id (FK roles). Vínculos org. (entidade/setor/
-- função) e dados de RH são preenchidos pelo RH/legado depois, logo nullable.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculos organizacionais / acesso (preenchidos após o 1º acesso).
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  setor_id UUID REFERENCES setor(id) ON DELETE RESTRICT,
  function_id UUID REFERENCES functions(id) ON DELETE RESTRICT,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,

  -- Autenticação
  email VARCHAR(255) NOT NULL,
  CONSTRAINT email_must_be_adventistas
    CHECK (email LIKE '%@adventistas.org'),
  CONSTRAINT unique_email_per_entity UNIQUE (entity_id, email),
  -- Hash scrypt para login local (formato scrypt:<salt>:<hash>). NULL = LDAP/SSO.
  password_hash TEXT,

  -- Informações básicas
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14),
  CONSTRAINT unique_cpf_per_entity UNIQUE (entity_id, cpf),
  telefone VARCHAR(20),
  avatar_url TEXT,

  -- Informações pessoais
  data_nascimento DATE,
  -- Sexo binário: 1 = masculino, 0 = feminino.
  sexo SMALLINT,
  CONSTRAINT sexo_binario CHECK (sexo IN (0, 1)),
  estado_civil_id UUID REFERENCES estados_civis(id) ON DELETE SET NULL,
  cidade VARCHAR(120),
  estado VARCHAR(2),          -- UF (2 letras)
  pis VARCHAR(11),            -- só dígitos, sem pontos/traços

  -- Dados bancários
  numero_banco VARCHAR(3),
  numero_conta VARCHAR(8),
  digito_conta VARCHAR(1),

  -- Informações de RH
  salario DECIMAL(12, 2),
  data_admissao DATE,
  data_demissao DATE,

  -- Hierarquia
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,

  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Código de matrícula do APS + código da entidade combinados (ex.:
-- "12345-164122"). Preenchido a partir do banco legado (SQL Server) no 1º
-- acesso do usuário — ver inserirUsuarioComLegado() em lib/database.ts e
-- buscarFuncionarioLegado() em lib/mssql.ts.
alter table users
  add codigo_aps_entidade VARCHAR(20);
  
-- Código de matrícula do funcionário no APS (enrollment_code), separado do
-- código combinado acima. VARCHAR (não INTEGER): é um identificador, não uma
-- quantidade, e preserva zero à esquerda se algum dia existir. Mesmo padrão
-- dos demais códigos do legado nesta tabela (cpf, pis, numero_banco, etc.).
alter table users
  add codigo_aps VARCHAR(10);

-- Tipo de vínculo trabalhista (CLT): regras de férias/benefícios diferem para
-- aprendiz e estagiário. Só 3 valores fixos e conhecidos em código — mesmo
-- padrão do status em ferias_solicitacoes (008_ferias.sql), sem tabela à
-- parte (não tem CRUD próprio nem atributo extra que justifique catálogo).
alter table users
  add tipo_funcionario VARCHAR(20) NOT NULL DEFAULT 'COLABORADOR'
    CHECK (tipo_funcionario IN ('COLABORADOR', 'APRENDIZ/ESTAGIÁRIO'));

-- Índices
CREATE INDEX idx_users_entity_id ON users(entity_id);
CREATE INDEX idx_users_setor_id ON users(setor_id);
CREATE INDEX idx_users_function_id ON users(function_id);
CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_estado_civil_id ON users(estado_civil_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cpf ON users(cpf);
CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Comentários
COMMENT ON TABLE users IS 'Usuários do ERP (login via LDAP/AD, SSO Microsoft ou senha local).';
COMMENT ON COLUMN users.role_id IS 'Papel/perfil de acesso (FK roles). Único por usuário.';
COMMENT ON COLUMN users.password_hash IS 'Hash scrypt da senha (login local). NULL = usa LDAP/SSO.';
COMMENT ON COLUMN users.sexo IS 'Sexo binário: 1 = masculino, 0 = feminino.';
COMMENT ON COLUMN users.estado IS 'UF (sigla do estado, 2 letras).';
COMMENT ON COLUMN users.pis IS 'PIS/PASEP — 11 dígitos, sem pontuação.';
COMMENT ON COLUMN users.numero_banco IS 'Código do banco (3 dígitos).';
COMMENT ON COLUMN users.avatar_url IS 'Foto (Microsoft Graph, upload local ou chave do storage).';
COMMENT ON COLUMN users.codigo_aps_entidade IS 'Código APS (enrollment_code) + código da entidade (entity_code) combinados, ex.: "12345-164122". Vem do legado no 1º acesso.';
COMMENT ON COLUMN users.codigo_aps IS 'Código de matrícula do funcionário no APS (enrollment_code), isolado. Vem do legado no 1º acesso.';
COMMENT ON COLUMN users.tipo_funcionario IS 'Tipo de vínculo trabalhista (CLT): COLABORADOR (padrão) ou APRENDIZ/ESTAGIÁRIO. Afeta regras de férias/benefícios.';

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security — mesma lógica dos outros módulos (ver o comentário
-- completo em 008_ferias.sql). 5º e ÚLTIMO módulo do piloto, e o mais
-- sensível: CPF, salário, conta bancária, data de nascimento moram aqui.
--
-- POR QUE 'users' FOI DEIXADA PRA ÚLTIMO: é a tabela mais referenciada do
-- sistema — JOINs em `ferias.ts`, `notificacoes.ts`, `qualificacoes.ts`,
-- `vr.service.ts`, `vr.export.ts`, além do próprio `usuarios.ts`. Os 4
-- primeiros já rodam dentro de `rodaComoUsuario` (RLS de férias/
-- qualificações/VR/comunicação) — essas transações continuam funcionando
-- sem mudar mais nada nelas.
--
-- DECISÃO DELIBERADA — LEITURA (SELECT) É PERMISSIVA, NÃO É POR PAPEL:
-- diferente de ferias_solicitacoes/qualificacoes_*, aqui a policy de leitura
-- NÃO restringe por "dono ou papel liberado". Motivo: há JOINs legítimos
-- onde um COLABORADOR precisa ver o NOME de OUTRA pessoa que não é ele
-- mesmo — ex.: `GET /notificacoes` mostra "Ana aprovou sua solicitação", e
-- `ator_nome` vem de um JOIN em `users` pela linha da Ana, não a do
-- colaborador. Restringir SELECT a "dono ou não-colaborador" quebraria esse
-- e outros JOINs parecidos. A proteção real contra exposição de CPF/
-- salário/conta bancária para quem não devia já está na API
-- (`mascararCamposSensiveis` em usuarios.ts, aplicada depois de buscar a
-- linha) — RLS aqui não tenta replicar mascaramento por COLUNA (Postgres
-- não faz isso nativamente via policy; precisaria de view com security
-- barrier, fora do escopo deste piloto). Por isso a policy de SELECT é
-- `USING (true)` sem condição nenhuma — ATENÇÃO: diferente das outras
-- tabelas deste piloto, isso vale até SEM nenhum contexto setado (uma
-- consulta direta via psql, ou uma rota que esqueça `rodaComoUsuario`,
-- ainda assim lê todas as linhas). O "fecha por padrão" do FORCE só entra
-- em jogo pra ESCRITA aqui (ver abaixo) — a leitura é intencionalmente
-- aberta pra todo mundo autenticado pela API, igual já é hoje.
--
-- ESCRITA (INSERT/UPDATE/DELETE) É A PROTEÇÃO DE VERDADE AQUI: é exatamente
-- a classe de bug já encontrada e corrigida nesta auditoria (auto-promoção
-- a ADMIN via PATCH /usuarios/:usuarioId). Com RLS, mesmo que uma rota
-- futura esqueça de checar o papel direito, o banco não vai aceitar a
-- escrita de qualquer jeito.
--   UPDATE: o próprio dono (auto-atendimento: telefone em PATCH /auth/me,
--     avatar em POST/DELETE /usuarios/:usuarioId/avatar, e os ajustes do
--     próprio fluxo de login — ver abaixo) OU ADMIN (edição completa de
--     outro usuário, PATCH /usuarios/:usuarioId) OU DP/COORDENADOR DP (só
--     liga/desliga pode_fracionar_ferias/pode_vender_ferias de qualquer
--     colaborador — ver PATCH /ferias/excecoes/:usuarioId).
--   INSERT/DELETE: só ADMIN — cobre importação em massa
--     (POST /usuarios/importar), atribuir gerente (POST /usuarios/gerentes)
--     e excluir usuário (DELETE /usuarios/:usuarioId).
--
-- FLUXO DE LOGIN (1º acesso): `findOrCreateUsuarioLocal`/`findOrCreateUser`
-- (LDAP e Microsoft OAuth) e `definirSenhaUsuario` (login local) criam/
-- atualizam a PRÓPRIA linha de quem está logando — só que isso acontece
-- ANTES de existir um JWT (é o processo que decide quem a pessoa é), então
-- não tem como usar o id dela em `rodaComoUsuario`. Essas rotas rodam com a
-- identidade "de sistema" (papel ADMIN), mesma convenção do cron job de
-- comunicação e do script test-vr.ts — ver auth.routes.ts/microsoft-oauth.ts.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

CREATE POLICY users_leitura ON users
  FOR SELECT
  USING (true);

CREATE POLICY users_criar ON users
  FOR INSERT
  WITH CHECK (current_setting('app.papel', true) = 'ADMIN');

CREATE POLICY users_atualizar ON users
  FOR UPDATE
  USING (
    id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP'])
  )
  WITH CHECK (
    id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP'])
  );

CREATE POLICY users_excluir ON users
  FOR DELETE
  USING (current_setting('app.papel', true) = 'ADMIN');
