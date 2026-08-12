-- 009_notificacoes.sql
-- Notificações (padrão "inbox"): uma linha por destinatário (fan-out).
-- O RH (e quem mais precisar) recebe uma notificação por ação relevante.
--
-- Princípios:
--   - Ator (quem fez a ação): FK para users → nome/avatar vêm por JOIN (atual).
--   - Texto (acao/detalhe): CONGELADO no momento do evento (histórico).
--   - Recurso de origem: ponteiro (referencia_tabela + referencia_id). O estado
--     "vivo" (ex.: se a solicitação de férias já foi decidida) vem por JOIN na
--     tabela original — a notificação só aponta, não é a fonte da verdade.
--   - Leitura: por destinatário (lida / lida_em).

CREATE TABLE IF NOT EXISTS notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Quem RECEBE a notificação (fan-out: uma linha por pessoa).
  destinatario_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Quem REALIZOU a ação (nome/avatar via JOIN). Null = ação do sistema.
  ator_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Tipo do evento, ex.: 'FERIAS_SOLICITADA', 'FERIAS_APROVADA', 'DOC_ENVIADO'.
  tipo VARCHAR(50) NOT NULL,
  -- Texto congelado no momento do evento (não muda depois).
  acao TEXT NOT NULL,          -- ex.: "solicitou férias"
  detalhe TEXT,                -- ex.: "21–28 nov · 7 dias"
  -- Ponteiro para o recurso de origem (deep-link + estado ao vivo por JOIN).
  referencia_tabela VARCHAR(50),   -- ex.: 'ferias_solicitacoes'
  referencia_id UUID,              -- id da linha na tabela de origem

  -- Se a notificação pede uma decisão (mostra Aprovar/Recusar no card). A ação
  -- e o status atuais vêm sempre da tabela de origem (referencia_*).
  requer_acao BOOLEAN NOT NULL DEFAULT FALSE,

  -- Estado de leitura (por destinatário).
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  lida_em TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Feed do destinatário (mais recentes primeiro).
CREATE INDEX idx_notificacoes_destinatario
  ON notificacoes(destinatario_id, created_at DESC);

-- Badge de não-lidas (índice parcial só nas pendentes).
CREATE INDEX idx_notificacoes_nao_lidas
  ON notificacoes(destinatario_id) WHERE NOT lida;

-- Localizar as notificações de um recurso (ex.: ao decidir uma solicitação,
-- marcar/atualizar as notificações ligadas a ela).
CREATE INDEX idx_notificacoes_referencia
  ON notificacoes(referencia_tabela, referencia_id);

-- Comentários
COMMENT ON TABLE notificacoes IS 'Notificações por destinatário (inbox). Aponta para o recurso de origem.';
COMMENT ON COLUMN notificacoes.destinatario_id IS 'Quem recebe (fan-out: uma linha por destinatário).';
COMMENT ON COLUMN notificacoes.ator_id IS 'Quem fez a ação (FK users; nome/avatar via JOIN). Null = sistema.';
COMMENT ON COLUMN notificacoes.tipo IS 'Tipo do evento (ex.: FERIAS_SOLICITADA).';
COMMENT ON COLUMN notificacoes.acao IS 'Texto do evento, congelado (ex.: "solicitou férias").';
COMMENT ON COLUMN notificacoes.referencia_tabela IS 'Tabela de origem do recurso (ex.: ferias_solicitacoes).';
COMMENT ON COLUMN notificacoes.referencia_id IS 'Id da linha na tabela de origem (deep-link/estado ao vivo).';
COMMENT ON COLUMN notificacoes.requer_acao IS 'Se pede decisão (Aprovar/Recusar) — status vem da tabela de origem.';
COMMENT ON COLUMN notificacoes.lida IS 'Se o destinatário já leu.';
