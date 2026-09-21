-- 19. COLUNA USERS.PARTICIPA_VR
--
-- Marca se um colaborador participa do Vale-Refeição ou não. Por padrão,
-- todo mundo participa (TRUE) — só quem for marcado explicitamente como
-- FALSE fica de fora das telas de VR (fechamento, relatórios, lançamentos),
-- mesmo estando ativo e vinculado a uma entidade que participa.
--
-- Motivo: setor Distrital + função Pastor Distrital nunca devem entrar no
-- VR (confirmado com o DP). Igual ao entities.participa_vr, mas no nível
-- da pessoa em vez da entidade — os dois filtros valem ao mesmo tempo.

ALTER TABLE users ADD COLUMN IF NOT EXISTS participa_vr BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN users.participa_vr IS 'Se FALSE, esse colaborador nunca aparece nas telas de VR (fechamento, relatórios, lançamentos), mesmo ativo';

-- Ajuste inicial confirmado com o DP: Setor Distrital + Pastor Distrital não participam do VR.
UPDATE users u
SET participa_vr = FALSE
FROM setor s, functions f
WHERE u.setor_id = s.id
  AND u.function_id = f.id
  AND s.nome = 'Distrital'
AND f.nome = 'Pastor Distrital';