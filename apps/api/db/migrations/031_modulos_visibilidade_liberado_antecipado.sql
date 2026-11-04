-- 031_modulos_visibilidade_liberado_antecipado.sql
-- Liberação antecipada do lançamento beta (ver LANCAMENTO_BETA_ATIVO em
-- apps/api/src/plugins/auth.ts e o espelho em
-- apps/web/src/features/auth/lib/modulos.ts), agora configurável por papel
-- na mesma tela "Visibilidade de módulos" (ADMIN) — substitui as exceções
-- que antes eram hardcoded no código (isentoBeta no item do VR,
-- papeisLiberadosBeta/PAPEIS_RH no Cursos).
--
-- UM toggle por (módulo, papel): `liberado_antecipado`. Ligado = sem cadeado
-- (acesso liberado antecipadamente, mesmo com o lançamento geral ainda
-- restrito a ADMIN). Desligado (default) = continua com cadeado — "em
-- desenvolvimento, vai abrir em breve pra esse papel". Independente de
-- `visivel` (030): só importa pra quem já enxerga o módulo.
--
-- Mesma tabela esparsa de 030: ausência de linha, ou liberado_antecipado =
-- FALSE, = continua com cadeado. ADMIN sempre libera tudo, independente
-- desta tabela — ver calcularModulosBetaLiberados em auth.routes.ts e
-- moduloLiberadoNoBeta no front.
--
-- `visivel` ganha um DEFAULT (TRUE) porque agora um UPSERT pode tocar só a
-- coluna `liberado_antecipado` (ex.: liberar o VR antecipadamente sem nunca
-- ter mexido na visibilidade dele) — sem o default, o INSERT dessa coluna
-- sozinha violaria o NOT NULL de `visivel`.

ALTER TABLE modulos_visibilidade ALTER COLUMN visivel SET DEFAULT TRUE;
ALTER TABLE modulos_visibilidade ADD COLUMN IF NOT EXISTS liberado_antecipado BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN modulos_visibilidade.liberado_antecipado IS
  'Libera este módulo antecipadamente pra este papel durante o lançamento beta — tira o cadeado e o bloqueio da rota/API mesmo com o lançamento geral ainda restrito a ADMIN. FALSE (default) = continua com cadeado.';

-- Backfill: reproduz as duas exceções hardcoded de hoje (VR pros papéis
-- elegíveis, Cursos pro RH) — dinâmico via subquery contra `roles` (cobre
-- "COORDENADOR DP", que nem está no seed de 004_roles.sql).
INSERT INTO modulos_visibilidade (modulo_codigo, role_id, liberado_antecipado)
SELECT 'vr', id, TRUE FROM roles WHERE codigo IN ('DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO')
ON CONFLICT (modulo_codigo, role_id) DO UPDATE SET liberado_antecipado = TRUE;

INSERT INTO modulos_visibilidade (modulo_codigo, role_id, liberado_antecipado)
SELECT 'cursos', id, TRUE FROM roles WHERE codigo = 'RH'
ON CONFLICT (modulo_codigo, role_id) DO UPDATE SET liberado_antecipado = TRUE;
