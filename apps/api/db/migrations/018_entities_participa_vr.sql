-- 17. COLUNA ENTITIES.PARTICIPA_VR
--
-- Marca se uma entidade participa do Vale-Refeição ou não. Por padrão,
-- toda entidade participa (TRUE) — só quem for marcado explicitamente
-- como FALSE fica de fora das listas de fechamento/lançamento de VR.
--
-- Motivo: algumas entidades (ex.: UNoB) nunca devem entrar no VR, mesmo
-- que tenham colaborador ativo vinculado. Isso também é o que faz o mês
-- inteiro ser considerado "fechado" quando todas as entidades que
-- participam já fecharam — sem esperar por quem nunca vai fechar.

ALTER TABLE entities ADD COLUMN IF NOT EXISTS participa_vr BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN entities.participa_vr IS 'Se FALSE, essa entidade nunca aparece nas telas de VR nem conta pro mês "fechar por completo"';

-- Ajuste inicial confirmado com o DP: UNoB não participa do VR.
UPDATE entities SET participa_vr = FALSE WHERE nome = 'UNoB';