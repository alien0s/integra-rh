CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  function_id UUID REFERENCES functions(id) ON DELETE RESTRICT,
  
  -- Autenticação Microsoft OAuth2
  email VARCHAR(255) NOT NULL,
  CONSTRAINT email_must_be_adventistas 
    CHECK (email LIKE '%@adventistas.org'),
  CONSTRAINT unique_email_per_entity UNIQUE (entity_id, email),
  
  -- Informações básicas
  nome VARCHAR(255) NOT NULL,
  cpf VARCHAR(14),
  CONSTRAINT unique_cpf_per_entity UNIQUE (entity_id, cpf),
  telefone VARCHAR(20),
  avatar_url TEXT,
  
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
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cpf ON users(cpf);
CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Comentários
COMMENT ON TABLE users IS 'Usuários do ERP com autenticação Microsoft OAuth2';
COMMENT ON COLUMN users.entity_id IS 'ID da empresa/entidade';
COMMENT ON COLUMN users.department_id IS 'ID do departamento (FK)';
COMMENT ON COLUMN users.function_id IS 'ID da função/cargo (FK)';
COMMENT ON COLUMN users.email IS 'Email corporativo @adventistas.org';
COMMENT ON COLUMN users.avatar_url IS 'URL da foto (Microsoft Graph ou upload local)';
COMMENT ON COLUMN users.manager_id IS 'ID do chefe direto';
