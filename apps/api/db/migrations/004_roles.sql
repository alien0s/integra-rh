-- 004_roles.sql
-- Catálogo de papéis/perfis de acesso. Criado ANTES de users, pois users.role_id
-- referencia esta tabela. O papel é ÚNICO por usuário (ver 006_users.sql).
-- `nivel` = privilégio (maior = mais poder). 7 é o nível máximo (ADMIN).
--
-- Descrição de cada papel (preenchida aos poucos, conforme definido pelo RH):
--   ADMIN (7): nível máximo — acesso total ao sistema.
--   PRESIDENTE (6): descrição pendente.
--   TESOUREIRO (5): descrição pendente.
--   ASSISTENTE (4): descrição pendente.
--   GESTOR (3): gestor/líder de setor — aprova a 1ª etapa das férias da equipe.
--   DP (3): Departamento Pessoal — confirma (2ª etapa) férias e gere feriados.
--   RH (3): Recursos Humanos — visão geral de férias (leitura).
--   COORDENADOR (2): descrição pendente.
--   COLABORADOR (1): descrição pendente.

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  nivel SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'Catálogo de papéis/perfis de acesso (um por usuário via users.role_id).';
COMMENT ON COLUMN roles.codigo IS 'Código estável do papel (ex.: ADMIN, PRESIDENTE).';
COMMENT ON COLUMN roles.nivel IS 'Nível de privilégio (maior = mais poder). 7 = máximo (ADMIN).';

INSERT INTO roles (codigo, nome, nivel) VALUES
  ('COLABORADOR', 'Colaborador',             1),
  ('COORDENADOR', 'Coordenador',             2),
  ('GESTOR',      'Departamental / Gerente', 3),
  ('DP',          'Departamento Pessoal',    3),
  ('RH',          'Recursos Humanos',        3),
  ('ASSISTENTE',  'Tesoureiro Assistente',   4),
  ('TESOUREIRO',  'Tesoureiro',              5),
  ('PRESIDENTE',  'Presidente',              6),
  ('ADMIN',       'Admin',                   7)
ON CONFLICT (codigo) DO NOTHING;
