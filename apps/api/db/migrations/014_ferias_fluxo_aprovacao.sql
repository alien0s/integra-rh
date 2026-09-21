-- 014_ferias_fluxo_aprovacao.sql
-- Evolui o módulo de férias para o fluxo de aprovação em DUAS etapas:
--   PENDENTE ─(gestor do setor aprova)→ APROVADO_GESTOR ─(DP confirma)→ APROVADO
--   PENDENTE | APROVADO_GESTOR ─(gestor/DP recusa + motivo)→ RECUSADO
--   PENDENTE | APROVADO_GESTOR ─(colaborador cancela)→ CANCELADO
--   APROVADO ─(DP/ADMIN cancela)→ CANCELADO
--
-- O fluxo é SEMPRE em duas etapas. Fallback: se o setor do solicitante não tem
-- gestor_id, ou se o próprio solicitante É o gestor do setor, a 1ª etapa é
-- pulada — a solicitação nasce em APROVADO_GESTOR e o DP faz a confirmação.
--
-- Idempotente (ADD COLUMN IF NOT EXISTS / ON CONFLICT). Aplicar via psql.

-- ── Gestor do setor (1ª etapa de aprovação) ───────────────────────────────
ALTER TABLE setor
  ADD COLUMN IF NOT EXISTS gestor_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_setor_gestor_id ON setor(gestor_id);
COMMENT ON COLUMN setor.gestor_id IS 'Gestor/líder do setor — aprova a 1ª etapa das férias da equipe (FK users).';

-- ── Papéis DP e RH no catálogo (nível 3, ao lado de GESTOR) ────────────────
INSERT INTO roles (codigo, nome, nivel) VALUES
  ('DP', 'Departamento Pessoal', 3),
  ('RH', 'Recursos Humanos',     3)
ON CONFLICT (codigo) DO NOTHING;

-- ── Colunas de aprovação em duas etapas + cancelamento ────────────────────
ALTER TABLE ferias_solicitacoes
  -- 1ª etapa — aprovação do gestor/líder do setor.
  ADD COLUMN IF NOT EXISTS aprovado_gestor_por UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_gestor_em TIMESTAMP WITH TIME ZONE,
  -- Cancelamento (colaborador enquanto não confirmado; DP após confirmado).
  ADD COLUMN IF NOT EXISTS cancelado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT;

-- (aprovado_por / decidido_em / confirmado já existem = 2ª etapa, o DP.)

-- ── Amplia a coluna status (o valor 'APROVADO_GESTOR' tem 15 chars) ────────
ALTER TABLE ferias_solicitacoes ALTER COLUMN status TYPE VARCHAR(20);

-- ── Amplia o CHECK de status para incluir APROVADO_GESTOR e CANCELADO ──────
ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_status_valido;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_status_valido
  CHECK (status IN ('PENDENTE', 'APROVADO_GESTOR', 'APROVADO', 'RECUSADO', 'CANCELADO'));

-- Índice para a listagem por status (visão geral / filtros) — já pode existir.
CREATE INDEX IF NOT EXISTS idx_ferias_status ON ferias_solicitacoes(status);

COMMENT ON COLUMN ferias_solicitacoes.status IS 'PENDENTE, APROVADO_GESTOR (1ª etapa/gestor), APROVADO (2ª/DP), RECUSADO ou CANCELADO.';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_gestor_por IS '1ª etapa: gestor do setor que aprovou (FK users). Nome via JOIN.';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_gestor_em IS 'Quando o gestor aprovou (1ª etapa).';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_por IS '2ª etapa (DP): quem confirmou/recusou (FK users). Nome via JOIN.';
COMMENT ON COLUMN ferias_solicitacoes.confirmado IS 'TRUE quando o DP confirmou (2ª etapa) — status APROVADO.';
COMMENT ON COLUMN ferias_solicitacoes.cancelado_por IS 'Quem cancelou (colaborador dono ou DP/ADMIN) — FK users.';
COMMENT ON COLUMN ferias_solicitacoes.motivo_cancelamento IS 'Motivo do cancelamento (opcional).';
