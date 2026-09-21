-- 023_comunicacao_recorrente.sql
-- Comunicados recorrentes não precisam de data_inicio/data_fim — só do dia_semana.
-- Não-recorrentes continuam exigindo o período normalmente.

ALTER TABLE comunicados
  ALTER COLUMN data_inicio DROP NOT NULL,
  ALTER COLUMN data_fim DROP NOT NULL;

-- Linhas recorrentes criadas antes dessa migration ainda têm datas
-- preenchidas (regra antiga) — limpa antes de adicionar a constraint nova.
UPDATE comunicados
SET data_inicio = NULL, data_fim = NULL
WHERE recorrente = true;

ALTER TABLE comunicados DROP CONSTRAINT IF EXISTS chk_periodo_valido;

ALTER TABLE comunicados ADD CONSTRAINT chk_periodo_valido CHECK (
  (recorrente = true AND data_inicio IS NULL AND data_fim IS NULL)
  OR
  (recorrente = false AND data_inicio IS NOT NULL AND data_fim IS NOT NULL AND data_fim >= data_inicio)
);