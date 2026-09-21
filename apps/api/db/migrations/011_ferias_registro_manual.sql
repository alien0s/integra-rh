-- 011_ferias_registro_manual.sql
-- Permite ao RH/Admin registrar manualmente uma férias/folga que já aconteceu
-- fora do sistema (histórico anterior à implantação, ou lançada por engano
-- fora do fluxo normal do colaborador). Esses registros já nascem como
-- APROVADO — não faz sentido "aprovar" algo que já aconteceu — e entram no
-- cálculo de saldo (GET /ferias/resumo) do ciclo aquisitivo vigente, para que
-- o sistema reflita corretamente se o colaborador ainda pode solicitar mais
-- férias naquele ciclo.

ALTER TABLE ferias_solicitacoes
  ADD COLUMN origem VARCHAR(20) NOT NULL DEFAULT 'SOLICITACAO';

ALTER TABLE ferias_solicitacoes
  ADD CONSTRAINT ferias_origem_valida
    CHECK (origem IN ('SOLICITACAO', 'REGISTRO_MANUAL'));

COMMENT ON COLUMN ferias_solicitacoes.origem IS
  'SOLICITACAO (pedido normal do colaborador, passa pelo fluxo de aprovação) ou REGISTRO_MANUAL (lançado pelo RH/Admin — histórico ou retroativo, já nasce APROVADO).';
