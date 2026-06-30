-- 1. TABELA ENTITIES (Empresas/Organizações)
-- 

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entities_cnpj ON entities(cnpj);

COMMENT ON TABLE entities IS 'Empresas/organizações do ERP';