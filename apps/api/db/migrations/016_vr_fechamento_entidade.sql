-- 16. TABELA VR_FECHAMENTO_ENTIDADE
--
-- Controla o fechamento do VR de forma independent por entidade, dentro do mesmo período de fechamento.
-- calendário de dias elegiveis continuam únicos por mes, apenas o fechamento que será por entidade

CREATE TABLE IF NOT EXISTS vr_fechamento_entidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vr_mes_id UUID NOT NULL REFERENCES vr_mes(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entities(id),
  fechado BOOLEAN NOT NULL DEFAULT FALSE,
  fechado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_vr_fechamento_entidade_mes_entidade_unico
  ON vr_fechamento_entidade (vr_mes_id, entity_id);

CREATE INDEX idx_vr_fechamento_entidade_vr_mes_id
  ON vr_fechamento_entidade (vr_mes_id);

COMMENT ON TABLE vr_fechamento_entidade IS 'Status de fechamento do VR por entidade, dentro de um vr_mes — cada entidade fecha e gera arquivos de forma independente';
COMMENT ON COLUMN vr_fechamento_entidade.fechado IS 'Indica se essa entidade já fechou o VR deste mês (bloqueia novos lançamentos retroativos e libera a exportação)';

-- Row Level Security — mesmo conjunto de papéis das outras tabelas de VR
-- (ver o comentário completo em 010_vale_refeicao.sql). Só por papel, sem
-- dono — ninguém acessa fechamento de entidade como autoatendimento.
ALTER TABLE vr_fechamento_entidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_fechamento_entidade FORCE ROW LEVEL SECURITY;

CREATE POLICY vr_fechamento_entidade_acesso ON vr_fechamento_entidade
  FOR ALL
  USING (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']))
  WITH CHECK (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']));
