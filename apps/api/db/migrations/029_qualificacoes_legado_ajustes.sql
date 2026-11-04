-- 029_qualificacoes_legado_ajustes.sql
-- Correções na sincronização de formação acadêmica a partir do legado (ver
-- lib/qualificacoes-legado.ts): o legado não tem "ano que entrou" (nenhuma
-- coluna guarda isso — verificado), então ano_inicio passa a ficar NULL na
-- sincronização em vez de inventado (= ano_fim). E como o nível vem de
-- dedução por palavra-chave (sem fonte autoritativa no legado), toda linha
-- sincronizada agora entra PENDENTE (igual ao fluxo manual do colaborador) e
-- marcada com nivel_deduzido, pro RH saber que esse campo merece atenção.

ALTER TABLE qualificacoes_academicas ALTER COLUMN ano_inicio DROP NOT NULL;

ALTER TABLE qualificacoes_academicas
  ADD COLUMN nivel_deduzido BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN qualificacoes_academicas.nivel_deduzido IS
  'TRUE quando o nivel foi adivinhado por palavra-chave a partir do nome do curso (sincronização do legado APS, sem informação de nível na fonte) — sinaliza pro RH que esse campo merece atenção na revisão.';

-- qualificacoes_cursos deixou de ser destino desta sincronização (tudo vira
-- qualificacoes_academicas agora, com nivel deduzido) — a coluna nunca foi
-- populada (0 linhas), remove por limpeza.
DROP INDEX IF EXISTS idx_qualificacoes_cursos_legado_curso;
ALTER TABLE qualificacoes_cursos DROP COLUMN IF EXISTS legado_curso_id;
