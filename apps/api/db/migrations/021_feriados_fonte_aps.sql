-- 21. FONTE 'APS' EM FERIADOS
--
-- Além de MANUAL (cadastro) e BRASILAPI (nacionais), agora também importamos
-- os feriados municipais/estaduais do sistema legado da empresa (banco APS,
-- tabela Locality_Holiday) — ver lib/mssql.ts (listarFeriadosLegado) e
-- lib/feriados.ts (importarFeriadosLegado).

ALTER TABLE feriados DROP CONSTRAINT feriados_fonte_valida;
ALTER TABLE feriados ADD CONSTRAINT feriados_fonte_valida
  CHECK (fonte IN ('MANUAL', 'BRASILAPI', 'APS'));

COMMENT ON COLUMN feriados.fonte IS 'MANUAL (cadastro), BRASILAPI ou APS (importados).';
