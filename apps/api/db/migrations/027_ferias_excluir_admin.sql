-- 027_ferias_excluir_admin.sql
-- Libera o ADMIN para excluir qualquer solicitação de férias/folga, mesmo
-- que não seja dele e mesmo que não esteja CANCELADA (ver excluirSolicitacao
-- em lib/ferias.ts — quem decide "pode mesmo?" continua sendo a API; a regra
-- de só-dono-e-só-cancelada permanece para todo mundo que não é ADMIN). A
-- policy original (008_ferias.sql) só liberava o próprio dono, sem exceção
-- nenhuma — igual as outras policies da tabela (leitura/criar/atualizar) já
-- liberam ADMIN, esta passa a liberar também.

DROP POLICY IF EXISTS ferias_excluir ON ferias_solicitacoes;

CREATE POLICY ferias_excluir ON ferias_solicitacoes
  FOR DELETE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = 'ADMIN'
  );
