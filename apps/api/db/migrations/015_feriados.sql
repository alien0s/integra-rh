-- 015_feriados.sql
-- Mapa de feriados definido pelo DP. Usado para limitar o calendário de
-- solicitação de férias: o início das férias não pode cair num feriado
-- (além de sexta/sábado/domingo). "Dias úteis" são DERIVADOS (todo dia que
-- não é fim de semana nem feriado) — não guardamos 365 linhas por ano.
--
-- Os feriados podem ser cadastrados manualmente ou importados dos nacionais
-- via BrasilAPI (fonte = 'BRASILAPI'). A importação é idempotente pelo
-- UNIQUE(data): re-importar não duplica.

CREATE TABLE IF NOT EXISTS feriados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Data do feriado (dia específico; não recorrente automático).
  data DATE NOT NULL UNIQUE,
  nome VARCHAR(120) NOT NULL,
  -- Abrangência do feriado.
  tipo VARCHAR(20) NOT NULL DEFAULT 'NACIONAL',
  CONSTRAINT feriados_tipo_valido
    CHECK (tipo IN ('NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'FACULTATIVO')),
  -- Ano (preenchido pela app a partir de `data`) — facilita filtro por ano.
  ano INTEGER NOT NULL,
  -- Origem do registro.
  fonte VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
  CONSTRAINT feriados_fonte_valida CHECK (fonte IN ('MANUAL', 'BRASILAPI')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feriados_ano ON feriados(ano);
CREATE INDEX IF NOT EXISTS idx_feriados_data ON feriados(data);

-- Mantém updated_at automaticamente (mesmo padrão de users/ferias).
CREATE OR REPLACE FUNCTION feriados_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feriados_updated_at_trigger ON feriados;
CREATE TRIGGER feriados_updated_at_trigger
BEFORE UPDATE ON feriados
FOR EACH ROW
EXECUTE FUNCTION feriados_set_updated_at();

COMMENT ON TABLE feriados IS 'Feriados (nacionais/estaduais/municipais/facultativos) que limitam o calendário de férias.';
COMMENT ON COLUMN feriados.data IS 'Data do feriado (UNIQUE — idempotência da importação).';
COMMENT ON COLUMN feriados.tipo IS 'NACIONAL, ESTADUAL, MUNICIPAL ou FACULTATIVO.';
COMMENT ON COLUMN feriados.ano IS 'Ano do feriado (derivado de data pela app).';
COMMENT ON COLUMN feriados.fonte IS 'MANUAL (cadastro) ou BRASILAPI (importado).';
