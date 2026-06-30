CREATE TABLE IF NOT EXISTS functions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  salario_base DECIMAL(12, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_functions_entity_id ON functions(entity_id);
CREATE UNIQUE INDEX idx_functions_unique ON functions(entity_id, nome);

COMMENT ON TABLE functions IS 'Funções/cargos disponíveis na empresa';