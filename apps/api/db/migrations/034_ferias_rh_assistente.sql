-- 034_ferias_rh_assistente.sql
-- Gestor (quando houver) → RH obrigatório → Tesoureiro Assistente.
-- Aplicar antes de publicar a API/interface. Preserva decisões históricas.
BEGIN;
SET LOCAL app.papel = 'ADMIN';

ALTER TABLE ferias_solicitacoes
  ADD COLUMN IF NOT EXISTS aprovado_rh_por UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aprovado_rh_em TIMESTAMPTZ;

ALTER TABLE ferias_solicitacoes DROP CONSTRAINT IF EXISTS ferias_status_valido;
ALTER TABLE ferias_solicitacoes ADD CONSTRAINT ferias_status_valido CHECK (
  status IN ('PENDENTE', 'APROVADO_GESTOR', 'APROVADO_RH', 'AJUSTE_SUGERIDO', 'APROVADO', 'RECUSADO', 'CANCELADO')
);

COMMENT ON COLUMN ferias_solicitacoes.status IS 'PENDENTE: gestor; APROVADO_GESTOR: RH; APROVADO_RH: Tesoureiro Assistente; AJUSTE_SUGERIDO; APROVADO; RECUSADO; CANCELADO.';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_rh_por IS 'Aprovação obrigatória do RH (2ª etapa). Null em registros manuais/importados e decisões anteriores à migration 034.';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_rh_em IS 'Quando o RH aprovou e encaminhou ao Tesoureiro Assistente.';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_por IS 'Autor da decisão final (confirmação pelo Tesoureiro Assistente ou recusa em qualquer etapa). Preserva autores históricos.';
COMMENT ON COLUMN ferias_solicitacoes.confirmado IS 'TRUE após confirmação final pelo Tesoureiro Assistente. Registros manuais/importados permanecem históricos confirmados.';
COMMENT ON COLUMN ferias_solicitacoes.ajuste_sugerido_por IS 'RH que sugeriu o ajuste na 2ª etapa; preserva autores anteriores à migration 034.';

-- Coord. DP acompanha todos os estados, sem aprovar/recusar. Mantém suas
-- operações administrativas existentes (registro histórico, exceções etc.).
DROP POLICY IF EXISTS ferias_leitura ON ferias_solicitacoes;
CREATE POLICY ferias_leitura ON ferias_solicitacoes FOR SELECT USING (
  user_id::text = current_setting('app.user_id', true)
  OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'GESTOR', 'RH', 'ASSISTENTE', 'DP', 'COORDENADOR DP'])
);

DROP POLICY IF EXISTS ferias_atualizar ON ferias_solicitacoes;
CREATE POLICY ferias_atualizar ON ferias_solicitacoes FOR UPDATE
USING (
  user_id::text = current_setting('app.user_id', true)
  OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'GESTOR', 'RH', 'ASSISTENTE'])
)
WITH CHECK (
  user_id::text = current_setting('app.user_id', true)
  OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'GESTOR', 'RH', 'ASSISTENTE'])
);

-- Cartões antigos do confirmador deixam de oferecer decisões. Pedidos já
-- aguardando a antiga 2ª etapa entram na fila do RH, sem aprová-los sozinhos.
UPDATE notificacoes SET requer_acao = FALSE
WHERE referencia_tabela = 'ferias_solicitacoes' AND tipo IN ('FERIAS_AGUARDA_DP', 'FOLGA_AGUARDA_DP');

INSERT INTO notificacoes (
  destinatario_id, ator_id, tipo, acao, detalhe,
  referencia_tabela, referencia_id, requer_acao
)
SELECT rh.id, f.user_id, f.tipo || '_AGUARDA_RH',
       'aguarda análise de Recursos Humanos',
       to_char(f.data_inicio, 'DD/MM/YYYY') || ' – ' || to_char(f.data_fim, 'DD/MM/YYYY'),
       'ferias_solicitacoes', f.id, TRUE
FROM ferias_solicitacoes f
JOIN users rh ON rh.id <> f.user_id AND rh.is_active = TRUE
JOIN roles r ON r.id = rh.role_id AND r.codigo = 'RH'
WHERE f.status = 'APROVADO_GESTOR'
  AND NOT EXISTS (
    SELECT 1 FROM notificacoes n
    WHERE n.destinatario_id = rh.id AND n.referencia_id = f.id
      AND n.referencia_tabela = 'ferias_solicitacoes' AND n.tipo = f.tipo || '_AGUARDA_RH'
  );
COMMIT;
