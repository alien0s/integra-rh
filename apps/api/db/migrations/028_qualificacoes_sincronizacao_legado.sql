-- 028_qualificacoes_sincronizacao_legado.sql
-- Sincronização automática de formação acadêmica a partir do legado (APS,
-- banco EAV/virtual: v_virtual_relationship_row + v_virtual_entity_row) —
-- ver sincronizarQualificacoesLegado em lib/qualificacoes-legado.ts.

-- Grau de instrução (escolaridade): 1 valor-resumo por pessoa no legado, sem
-- curso/instituição/data associados — por isso vira campo solto no cadastro
-- do funcionário, não uma linha de qualificação. Sem CHECK: o catálogo do
-- legado tem variações de acentuação/espaço (ex. "Pos Doutorado" sem acento,
-- "Até o 5º.ano incompleta do E. Fundamental " com espaço sobrando).
ALTER TABLE users ADD COLUMN escolaridade VARCHAR(60);

COMMENT ON COLUMN users.escolaridade IS
  'Grau de instrução vindo do legado (APS, relacionamento EMPLOYEE/GRAU_INSTRUCAO) — ver sincronizarQualificacoesLegado em lib/qualificacoes-legado.ts. Texto livre (sem CHECK): o catálogo do legado tem variações de acentuação/espaço.';

-- legado_curso_id guarda o id do curso no catálogo CURSO do legado (entidade
-- virtual 98664) — mesma função de legado_evento_id em ferias_solicitacoes
-- (026_ferias_sincronizacao_legado.sql): dedup/marcador de origem, NULL em
-- registros cadastrados por humano (colaborador ou RH), nunca tocados pela
-- sincronização. Diferente de ferias (evento = 1 pessoa, UNIQUE global), o
-- mesmo curso do catálogo é usado por muitas pessoas — por isso o índice
-- único é composto (user_id, legado_curso_id).
ALTER TABLE qualificacoes_academicas ADD COLUMN legado_curso_id INTEGER;

CREATE UNIQUE INDEX idx_qualificacoes_academicas_legado_curso
  ON qualificacoes_academicas(user_id, legado_curso_id)
  WHERE legado_curso_id IS NOT NULL;

COMMENT ON COLUMN qualificacoes_academicas.legado_curso_id IS
  'id do curso no catálogo CURSO do legado (APS, entidade virtual 98664) quando a linha veio da sincronização automática. NULL em registros cadastrados pelo colaborador ou pelo RH.';

-- Cursos classificados como "Curso Livre" pela dedução de nível (sem prefixo
-- que indique um nível acadêmico reconhecível, ex.: "Informatica Basica",
-- "Relacoes Humanas") caem aqui em vez de qualificacoes_academicas — mesma
-- origem/regra de dedup do comentário acima.
ALTER TABLE qualificacoes_cursos ADD COLUMN legado_curso_id INTEGER;

CREATE UNIQUE INDEX idx_qualificacoes_cursos_legado_curso
  ON qualificacoes_cursos(user_id, legado_curso_id)
  WHERE legado_curso_id IS NOT NULL;

COMMENT ON COLUMN qualificacoes_cursos.legado_curso_id IS
  'Mesma origem/regra de qualificacoes_academicas.legado_curso_id — cursos classificados como "Curso Livre" (sem nível acadêmico reconhecível) caem aqui em vez de qualificacoes_academicas.';

-- INSERT hoje só libera o próprio dono (013_qualificacoes.sql) — a
-- sincronização roda sob a identidade de sistema do login (papel ADMIN, ver
-- USUARIO_SISTEMA_LOGIN em auth.routes.ts/microsoft-oauth.ts), então precisa
-- do mesmo bypass que já existe em ferias_criar (mesmo padrão usado em
-- 027_ferias_excluir_admin.sql pra DELETE).
DROP POLICY IF EXISTS qualificacoes_academicas_criar ON qualificacoes_academicas;

CREATE POLICY qualificacoes_academicas_criar ON qualificacoes_academicas
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );

DROP POLICY IF EXISTS qualificacoes_cursos_criar ON qualificacoes_cursos;

CREATE POLICY qualificacoes_cursos_criar ON qualificacoes_cursos
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );
