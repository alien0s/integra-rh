-- 005_estados_civis.sql
-- Catálogo de estado civil. Criado ANTES de users (users.estado_civil_id o
-- referencia). Conjunto fixo de opções; espelha a tabela Marital_Status do
-- banco legado, facilitando o mapeamento no enriquecimento.

CREATE TABLE IF NOT EXISTS estados_civis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nome VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE estados_civis IS 'Catálogo de estado civil (um por usuário via users.estado_civil_id).';

INSERT INTO estados_civis (codigo, nome) VALUES
  ('SOLTEIRO',   'Solteiro(a)'),
  ('CASADO',     'Casado(a)'),
  ('SEPARADO',   'Separado(a)'),
  ('DIVORCIADO', 'Divorciado(a)'),
  ('VIUVO',      'Viúvo(a)')
ON CONFLICT (codigo) DO NOTHING;
