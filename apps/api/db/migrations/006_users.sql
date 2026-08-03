-- 006_users.sql
-- Tabela central de usuários do ERP.
-- Login: LDAP/AD (principal), Microsoft OAuth (SSO) ou senha local (password_hash).
-- Papel de acesso ÚNICO via role_id (FK roles). Vínculos org. (entidade/depto/
-- função) e dados de RH são preenchidos pelo RH/legado depois, logo nullable.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculos organizacionais / acesso (preenchidos após o 1º acesso).
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
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

-- Índices
CREATE INDEX idx_users_entity_id ON users(entity_id);
CREATE INDEX idx_users_department_id ON users(department_id);
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
