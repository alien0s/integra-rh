-- 026_ferias_sincronizacao_legado.sql
-- Sincronização automática do histórico de férias a partir do eSocial (APS,
-- evento S-2230, código de afastamento 15) — ver sincronizarFeriasLegado()
-- em lib/ferias.ts. `legado_evento_id` guarda o id_evento (PK real da
-- tabela dbo.eSocial_Eventos no legado) só nas linhas criadas por essa
-- sincronização — NULL em toda solicitação normal ou registro manual feito
-- por um humano. Serve de chave de deduplicação (evita reimportar o mesmo
-- evento a cada login) e de marcador de origem.

ALTER TABLE ferias_solicitacoes
  ADD COLUMN legado_evento_id INTEGER UNIQUE;

COMMENT ON COLUMN ferias_solicitacoes.legado_evento_id IS
  'id_evento do eSocial (dbo.eSocial_Eventos, legado APS) quando a linha veio da sincronização automática (ver sincronizarFeriasLegado em lib/ferias.ts). NULL em solicitações normais ou registros manuais feitos por um humano.';
