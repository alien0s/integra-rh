-- 035_ferias_coord_dp_subordinadas.sql
-- Chefia no setor: manager_id = coordenador; gestor_id = gerente. Ambos opcionais.
-- Coord. DP decide só a 1ª etapa das pessoas DP vinculadas ao seu setor.
-- Não atribui chefias automaticamente nem altera registros de férias.
BEGIN;
ALTER TABLE setor
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_setor_manager_id ON setor(manager_id);
COMMENT ON COLUMN setor.manager_id IS 'Coordenador do setor (opcional). No fluxo de férias, Coord. DP decide a 1ª etapa das pessoas DP deste setor.';
COMMENT ON COLUMN setor.gestor_id IS 'Gerente do setor (opcional). Decide a 1ª etapa das férias quando não houver a exceção de Coord. DP da subordinada DP.';

DROP POLICY IF EXISTS ferias_atualizar_coord_dp ON ferias_solicitacoes;
CREATE POLICY ferias_atualizar_coord_dp ON ferias_solicitacoes FOR UPDATE
USING (
  status = 'PENDENTE'
  AND current_setting('app.papel', true) = 'COORDENADOR DP'
  AND user_id::text <> current_setting('app.user_id', true)
  AND EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id AND r.codigo = 'DP'
    JOIN setor s ON s.id = u.setor_id
    JOIN users coord ON coord.id = s.manager_id AND coord.is_active = TRUE
    JOIN roles rc ON rc.id = coord.role_id AND rc.codigo = 'COORDENADOR DP'
    WHERE u.id = ferias_solicitacoes.user_id
      AND coord.id::text = current_setting('app.user_id', true)
  )
)
WITH CHECK (
  current_setting('app.papel', true) = 'COORDENADOR DP'
  AND user_id::text <> current_setting('app.user_id', true)
  AND EXISTS (
    SELECT 1 FROM users u
    JOIN roles r ON r.id = u.role_id AND r.codigo = 'DP'
    JOIN setor s ON s.id = u.setor_id
    JOIN users coord ON coord.id = s.manager_id AND coord.is_active = TRUE
    JOIN roles rc ON rc.id = coord.role_id AND rc.codigo = 'COORDENADOR DP'
    WHERE u.id = ferias_solicitacoes.user_id
      AND coord.id::text = current_setting('app.user_id', true)
  )
  AND (
    (status = 'APROVADO_GESTOR'
      AND aprovado_gestor_por::text = current_setting('app.user_id', true)
      AND aprovado_gestor_em IS NOT NULL)
    OR (status = 'RECUSADO'
      AND aprovado_por::text = current_setting('app.user_id', true)
      AND NULLIF(btrim(motivo_recusa), '') IS NOT NULL)
  )
);
COMMIT;
