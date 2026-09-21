-- 024_ferias_excecoes.sql
-- Exceções de férias liberadas pelo DP, por colaborador (não é padrão pra
-- todo mundo — cada uma vale só se marcada TRUE):
--   pode_fracionar_ferias: pode dividir o ciclo (30 dias) em até 2 períodos,
--     cada um entre 10 e 15 dias corridos (ver criarSolicitacao em
--     lib/ferias.ts). Sem a exceção, continua só 1 período por ciclo.
--   pode_vender_ferias: pode vender até 10 dias (abono pecuniário, regra CLT
--     de até 1/3 de 30) em vez de tirá-los de férias.
-- Gerenciadas na aba "Exceções" (DP/COORDENADOR DP/ADMIN) — ver
-- ExcecoesFeriasAdmin.tsx e GET/PATCH /ferias/excecoes.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pode_fracionar_ferias BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pode_vender_ferias BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.pode_fracionar_ferias IS 'Liberado pelo DP: pode dividir o ciclo de férias em até 2 períodos de 10-15 dias.';
COMMENT ON COLUMN users.pode_vender_ferias IS 'Liberado pelo DP: pode vender até 10 dias de férias (abono pecuniário).';

-- Quantos dias desse pedido foram declarados como vendidos (abono), em vez
-- de tirados como descanso. Só > 0 quando o colaborador tem
-- pode_vender_ferias. Consome o saldo do ciclo igual aos dias tirados (ver
-- getResumoFerias) — vender também "gasta" o período aquisitivo.
ALTER TABLE ferias_solicitacoes ADD COLUMN IF NOT EXISTS dias_vendidos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_dias_vendidos_valido;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_dias_vendidos_valido
  CHECK (dias_vendidos BETWEEN 0 AND 10);

COMMENT ON COLUMN ferias_solicitacoes.dias_vendidos IS 'Dias vendidos (abono pecuniário) nesse pedido, 0-10. Exige users.pode_vender_ferias.';
