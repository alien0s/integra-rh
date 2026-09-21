-- 008_ferias.sql
-- Módulo de Férias/Folga: solicitações do colaborador e a decisão do gestor.
-- NÃO EXECUTADO AINDA — apenas para análise. Revise antes de aplicar via psql.
--
-- Modelo (a partir das telas do módulo):
--   - Cada linha é UMA solicitação (férias ou folga) feita por um usuário.
--   - Status: PENDENTE (aguardando), APROVADO ou RECUSADO (com justificativa).
--   - "Solicitado em" = created_at; o período é data_inicio..data_fim.
--   - O "ciclo"/período aquisitivo de referência é guardado para histórico
--     (é derivado da data de admissão, mas congelamos aqui o que valia).
--   - Saldo ("dias restantes X/30") NÃO fica aqui: é calculado a partir das
--     solicitações aprovadas + a regra de negócio.

CREATE TABLE IF NOT EXISTS ferias_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem solicitou (colaborador).
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- FERIAS ou FOLGA (as duas abas do formulário).
  tipo VARCHAR(10) NOT NULL,
  CONSTRAINT ferias_tipo_valido CHECK (tipo IN ('FERIAS', 'FOLGA')),
  -- Período solicitado (datas corridas, inclusive).
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  CONSTRAINT ferias_periodo_valido CHECK (data_fim >= data_inicio),
  -- Quantidade de dias corridos do período (derivável de início/fim, mas
  -- guardado para facilitar listagem/relatórios). Deve ser positivo.
  dias INTEGER NOT NULL,
  CONSTRAINT ferias_dias_positivo CHECK (dias > 0),
  -- Observações do colaborador para o gestor (opcional).
  observacoes TEXT,
  -- Período aquisitivo de referência (o "ciclo" mostrado no card). Opcional.
  periodo_aquisitivo_inicio DATE,
  periodo_aquisitivo_fim DATE,
  -- Situação da solicitação (fluxo single-step nesta migration):
  --   PENDENTE → APROVADO | RECUSADO
  -- O fluxo de DUAS etapas (gestor → DP) e o CANCELADO são adicionados em
  -- 014_ferias_fluxo_aprovacao.sql (ALTER TABLE), não aqui.
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  CONSTRAINT ferias_status_valido
    CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO')),

  -- Aprovação/decisão. Nome/e-mail de quem aprovou via JOIN em users.
  aprovado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMP WITH TIME ZONE,
  -- Confirmação (binário) — ex.: aprovação confirmada/efetivada.
  confirmado BOOLEAN NOT NULL DEFAULT FALSE,
  -- Justificativa obrigatória ao recusar (modal de rejeição).
  motivo_recusa TEXT,
  CONSTRAINT ferias_recusa_com_motivo
    CHECK (status <> 'RECUSADO' OR motivo_recusa IS NOT NULL),

  -- Auditoria. created_at = "solicitado em".
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para os filtros/listagens da tela (por usuário, por status, por data).
CREATE INDEX idx_ferias_user_id ON ferias_solicitacoes(user_id);
CREATE INDEX idx_ferias_status ON ferias_solicitacoes(status);
CREATE INDEX idx_ferias_data_inicio ON ferias_solicitacoes(data_inicio);

-- Mantém updated_at automaticamente em cada UPDATE (mesmo padrão de users).
CREATE OR REPLACE FUNCTION ferias_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ferias_updated_at_trigger
BEFORE UPDATE ON ferias_solicitacoes
FOR EACH ROW
EXECUTE FUNCTION ferias_set_updated_at();

-- Comentários
COMMENT ON TABLE ferias_solicitacoes IS 'Solicitações de férias/folga e a decisão do gestor.';
COMMENT ON COLUMN ferias_solicitacoes.tipo IS 'FERIAS ou FOLGA.';
COMMENT ON COLUMN ferias_solicitacoes.dias IS 'Dias corridos do período (data_fim - data_inicio + 1).';
COMMENT ON COLUMN ferias_solicitacoes.status IS 'PENDENTE, APROVADO ou RECUSADO (fluxo de 2 etapas + CANCELADO em 014).';
COMMENT ON COLUMN ferias_solicitacoes.motivo_recusa IS 'Justificativa obrigatória quando RECUSADO.';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_por IS 'Quem aprovou/recusou (FK users). E-mail/nome via JOIN.';
COMMENT ON COLUMN ferias_solicitacoes.confirmado IS 'Confirmação (binário) da aprovação/efetivação.';
COMMENT ON COLUMN ferias_solicitacoes.periodo_aquisitivo_inicio IS 'Início do ciclo aquisitivo de referência (histórico).
