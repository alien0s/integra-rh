CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_departments_entity_id ON departments(entity_id);
CREATE UNIQUE INDEX idx_departments_unique ON departments(entity_id, nome);

COMMENT ON TABLE departments IS 'Departamentos/setores da empresa';