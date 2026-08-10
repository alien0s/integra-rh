-- Departamentos/setores — INDEPENDENTES de entidade (globais no ERP).
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_departments_nome ON departments(nome);

COMMENT ON TABLE departments IS 'Departamentos/setores do ERP (independentes de entidade)';
