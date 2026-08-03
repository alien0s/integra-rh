-- 004_roles.sql
-- Catálogo de papéis/perfis de acesso. Criado ANTES de users, pois users.role_id
-- referencia esta tabela. O papel é ÚNICO por usuário (ver 005_users.sql).
-- `nivel` = privilégio (usado para desempate/ordenção).

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  nivel SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Catálogo de papéis/perfis de acesso (um por usuário via users.role_id).';
COMMENT ON COLUMN roles.codigo IS 'Código estável do papel (ex.: ADMIN, RH).';
COMMENT ON COLUMN roles.nivel IS 'Nível de privilégio (maior = mais poder).';

INSERT INTO roles (codigo, nome, nivel) VALUES
  ('COLABORADOR', 'Colaborador',              0),
  ('GESTOR',      'Gestor / Gerente',         2),
  ('DP',          'Departamento Pessoal',     2),
  ('RH',          'Recursos Humanos',         3),
  ('DIRETORIA',   'Diretoria',                4),
  ('ADMIN',       'Administrador do sistema', 5)
ON CONFLICT (codigo) DO NOTHING;
