-- 21. VR_MES.GRUPO — cada grupo (campo) passa a ter o seu próprio mês de VR
--
-- Até aqui o vr_mes era único pra empresa toda. Agora cada grupo
-- (ACeAm, ANRA, ...) tem o seu: valores diários, dias elegíveis, status
-- aberto/fechado, e a regra de "só 1 mês aberto por vez" vale POR GRUPO.
-- O grupo vem de entities.grupo (cada grupo tem as suas RADOAM, NT Store...).
--
-- IMPORTANTE: o vr_mes tem RLS (segurança por linha) FORÇADO, então até o dono
-- da tabela (erpuser) enxerga 0 linhas fora da API — o UPDATE abaixo não pegaria
-- nada e o SET NOT NULL falharia. Por isso tudo roda numa TRANSAÇÃO: o RLS é
-- des-forçado só até o COMMIT (a tabela fica bloqueada pra os outros nesse tempo)
-- e volta a ser forçado no fim. Se der erro no meio, rode ROLLBACK;
--
-- Execute o SCRIPT INTEIRO (Alt+X no DBeaver), não comando por comando.

BEGIN;

ALTER TABLE vr_mes NO FORCE ROW LEVEL SECURITY;

ALTER TABLE vr_mes ADD COLUMN IF NOT EXISTS grupo VARCHAR(10);

-- Tudo que existe até hoje é do grupo ACeAm.
UPDATE vr_mes SET grupo = 'ACeAm' WHERE grupo IS NULL;

ALTER TABLE vr_mes ALTER COLUMN grupo SET NOT NULL;

ALTER TABLE vr_mes DROP CONSTRAINT IF EXISTS vr_mes_grupo_valido;
ALTER TABLE vr_mes
  ADD CONSTRAINT vr_mes_grupo_valido
  CHECK (grupo IN ('UNoB', 'ANRA', 'ACeAm', 'Asur', 'AAmaR', 'MLa'));

-- Era único por (mes, ano); agora é único por (grupo, mes, ano).
DROP INDEX IF EXISTS idx_vr_mes_mes_ano_unico;
CREATE UNIQUE INDEX IF NOT EXISTS idx_vr_mes_grupo_mes_ano_unico ON vr_mes (grupo, mes, ano);
CREATE INDEX IF NOT EXISTS idx_vr_mes_grupo ON vr_mes (grupo);

COMMENT ON COLUMN vr_mes.grupo IS 'Grupo (campo) dono do mês: ACeAm, ANRA... — cada grupo tem o seu mês, valores, dias e fechamento';

-- Conferência (aqui dentro da transação você enxerga as linhas): tudo deve estar ACeAm.
SELECT id, grupo, mes, ano, fechado FROM vr_mes ORDER BY ano, mes;

-- Volta ao estado original (no seu banco estava rls_forcado = true).
ALTER TABLE vr_mes FORCE ROW LEVEL SECURITY;

COMMIT;
