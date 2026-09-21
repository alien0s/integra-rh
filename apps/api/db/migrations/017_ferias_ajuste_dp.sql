-- 017_ferias_ajuste_dp.sql
-- Ajuste de data sugerido pelo DP: na 2ª etapa (APROVADO_GESTOR), em vez de
-- só confirmar ou recusar, o DP pode devolver ao colaborador uma sugestão de
-- deslocar o período em até 5 dias (adiando ou antecipando), mantendo a
-- mesma quantidade de dias corridos do pedido original.
--
--   APROVADO_GESTOR ─(DP sugere ajuste + motivo)→ AJUSTE_SUGERIDO
--   AJUSTE_SUGERIDO ─(colaborador aceita/"OK")→ PENDENTE | APROVADO_GESTOR
--     (mesmo fallback de criarSolicitacao: sem gestor no setor, ou o próprio
--     solicitante é o gestor, pula direto pra APROVADO_GESTOR)
--     — aplica data_inicio_sugerida/data_fim_sugerida como o novo período e
--     volta a passar pela aprovação do gestor e confirmação do DP.
--
-- Não existe uma "recusa do ajuste" separada: se o colaborador não concorda
-- com a data sugerida, cancela a solicitação inteira (ação já existente).
--
-- Idempotente (ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS). Aplicar
-- via psql.

ALTER TABLE ferias_solicitacoes
  ADD COLUMN IF NOT EXISTS data_inicio_sugerida DATE,
  ADD COLUMN IF NOT EXISTS data_fim_sugerida DATE,
  ADD COLUMN IF NOT EXISTS ajuste_sugerido_por UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ajuste_sugerido_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS motivo_ajuste TEXT;

-- ── Novo status no fluxo: AJUSTE_SUGERIDO ──────────────────────────────────
ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_status_valido;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_status_valido
  CHECK (status IN (
    'PENDENTE', 'APROVADO_GESTOR', 'AJUSTE_SUGERIDO', 'APROVADO', 'RECUSADO', 'CANCELADO'
  ));

-- ── Os dois campos de data sugerida vêm sempre juntos (ou nenhum) ──────────
ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_ajuste_par_completo;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_ajuste_par_completo
  CHECK ((data_inicio_sugerida IS NULL) = (data_fim_sugerida IS NULL));

-- ── Só desloca o período — a duração sugerida tem que ser igual à original ─
ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_ajuste_mesma_duracao;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_ajuste_mesma_duracao
  CHECK (
    data_inicio_sugerida IS NULL
    OR (data_fim_sugerida - data_inicio_sugerida) = (data_fim - data_inicio)
  );

-- ── Limite de 5 dias de deslocamento (antes ou depois) do início atual ─────
ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_ajuste_dentro_do_limite;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_ajuste_dentro_do_limite
  CHECK (
    data_inicio_sugerida IS NULL
    OR ABS(data_inicio_sugerida - data_inicio) <= 5
  );

-- ── AJUSTE_SUGERIDO exige a data sugerida e o motivo (motivo obrigatório) ──
ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_ajuste_sugerido_completo;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_ajuste_sugerido_completo
  CHECK (
    status <> 'AJUSTE_SUGERIDO'
    OR (data_inicio_sugerida IS NOT NULL AND motivo_ajuste IS NOT NULL)
  );

COMMENT ON COLUMN ferias_solicitacoes.status IS 'PENDENTE, APROVADO_GESTOR (1ª etapa/gestor), AJUSTE_SUGERIDO (DP propôs nova data), APROVADO (2ª/DP), RECUSADO ou CANCELADO.';
COMMENT ON COLUMN ferias_solicitacoes.data_inicio_sugerida IS 'Novo início proposto pelo DP (desloca até 5 dias, mesma duração) — só vira o período oficial quando o colaborador aceitar.';
COMMENT ON COLUMN ferias_solicitacoes.data_fim_sugerida IS 'Fim correspondente ao início sugerido (mesma quantidade de dias do pedido original).';
COMMENT ON COLUMN ferias_solicitacoes.ajuste_sugerido_por IS 'DP que sugeriu o ajuste (FK users).';
COMMENT ON COLUMN ferias_solicitacoes.ajuste_sugerido_em IS 'Quando o ajuste foi sugerido.';
COMMENT ON COLUMN ferias_solicitacoes.motivo_ajuste IS 'Justificativa do DP pro ajuste sugerido — obrigatória.';
