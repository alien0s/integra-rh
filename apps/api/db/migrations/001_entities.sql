-- 1. TABELA ENTITIES (Empresas/Organizações)
-- 

CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  -- Grupo/união a que a entidade pertence (valores fixos, usados como filtro).
  grupo VARCHAR(10),
  CONSTRAINT grupo_valido
    CHECK (grupo IN ('UNoB', 'ANRA', 'ACeAm', 'Asur', 'AAmaR', 'MLa')),
  -- Código APS da entidade — sempre 6 dígitos inteiros (ex.: 164122).
  codigo_aps INTEGER,
  CONSTRAINT codigo_aps_6_digitos
    CHECK (codigo_aps BETWEEN 100000 AND 999999),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entities_cnpj ON entities(cnpj);
CREATE INDEX idx_entities_grupo ON entities(grupo);
-- Código APS único por entidade (usado para mapear o Cod_Entidade do legado).
CREATE UNIQUE INDEX idx_entities_codigo_aps_unico
  ON entities (codigo_aps) WHERE codigo_aps IS NOT NULL;

COMMENT ON TABLE entities IS 'Empresas/organizações do ERP';
COMMENT ON COLUMN entities.grupo IS 'Grupo/união da entidade (UNoB, ANRA, ACeAm, Asur, AAmaR, MLa). Usado como filtro.';
COMMENT ON COLUMN entities.codigo_aps IS 'Código APS da entidade (6 dígitos inteiros, ex.: 164122).';