-- 037_fluxo_aprovadores.sql
-- Configuração de EXCEÇÕES ao fluxo de aprovação de um módulo (hoje só
-- Férias, mas a tabela é module-agnostic — modulo/etapa são texto livre, não
-- travados a 'FERIAS'). Tabela ESPARSA, mesma filosofia de
-- modulos_visibilidade (030): ausência de linha = comportamento padrão
-- hardcoded do módulo (ver PAPEL_POR_ETAPA em feriasFluxo.ts); uma linha
-- aqui é sempre uma SUBSTITUIÇÃO da resolução padrão para aquele escopo,
-- nunca uma soma — por isso um usuário com setor_ids precisa listar TODOS
-- os setores que devem aprová-lo naquela etapa (inclusive o setor dele
-- mesmo), não só os "extras".
--
-- Duas dimensões independentes por linha:
--   ESCOPO (quem a exceção afeta): grupo de entidade (entities.grupo) OU
--     um usuário específico — nunca os dois, nunca nenhum.
--   RESOLUÇÃO (quem decide): um papel específico (roles) OU uma lista de
--     setores (setor) — nunca os dois, nunca nenhum. setor_ids é um array
--     nativo do Postgres (sem tabela auxiliar de "grupo de setores"); mais
--     de um id já é, por si só, a multiaprovação (todos precisam aprovar).
--
-- IMPORTANTE: esta migration só cria o armazenamento + é consumida pela
-- tela de configuração (FluxoAprovacaoAdmin.tsx, módulo Férias). O fluxo
-- real de decisão (feriasFluxo.ts e as políticas RLS de
-- ferias_solicitacoes) AINDA NÃO lê esta tabela — continua hardcoded como
-- hoje. Conectar de fato é um passo seguinte, feito à parte.
--
-- Sem RLS: config/catálogo puro, sem dono de linha — mesma convenção de
-- roles/setor/modulos_visibilidade (controle de acesso só na rota,
-- exigirPapeis() em ferias.routes.ts). Sem FK em cada elemento de
-- setor_ids (Postgres não suporta FK em array) — validado na API.

BEGIN;

CREATE TABLE IF NOT EXISTS fluxo_aprovadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo VARCHAR(50) NOT NULL,
  etapa VARCHAR(50) NOT NULL,
  grupo VARCHAR(10),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  papel_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  setor_ids UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT fluxo_aprovadores_escopo CHECK (
    (grupo IS NOT NULL AND user_id IS NULL) OR (grupo IS NULL AND user_id IS NOT NULL)
  ),
  CONSTRAINT fluxo_aprovadores_resolucao CHECK (
    (papel_id IS NOT NULL AND setor_ids IS NULL)
    OR (papel_id IS NULL AND setor_ids IS NOT NULL AND array_length(setor_ids, 1) > 0)
  )
);

-- No máximo uma exceção por (módulo, etapa, grupo) e por (módulo, etapa, usuário).
CREATE UNIQUE INDEX IF NOT EXISTS idx_fluxo_aprovadores_grupo
  ON fluxo_aprovadores(modulo, etapa, grupo) WHERE grupo IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fluxo_aprovadores_user
  ON fluxo_aprovadores(modulo, etapa, user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE fluxo_aprovadores IS
  'Exceções configuráveis ao fluxo padrão de aprovação de um módulo (hoje só a tela de Férias usa). Ausência de linha = comportamento hardcoded do módulo. Ainda não conectada à decisão real (ver comentário no topo da migration 037).';
COMMENT ON COLUMN fluxo_aprovadores.modulo IS 'Código do módulo dono da regra (ex.: FERIAS).';
COMMENT ON COLUMN fluxo_aprovadores.etapa IS 'Etapa do fluxo daquele módulo (ex.: PENDENTE, APROVADO_GESTOR, APROVADO_RH — ver PAPEL_POR_ETAPA em feriasFluxo.ts).';
COMMENT ON COLUMN fluxo_aprovadores.grupo IS 'Escopo: grupo de entidade (entities.grupo). Mutuamente exclusivo com user_id.';
COMMENT ON COLUMN fluxo_aprovadores.user_id IS 'Escopo: usuário específico. Mutuamente exclusivo com grupo.';
COMMENT ON COLUMN fluxo_aprovadores.papel_id IS 'Resolução: papel responsável pela etapa. Mutuamente exclusivo com setor_ids.';
COMMENT ON COLUMN fluxo_aprovadores.setor_ids IS 'Resolução: setor(es) cujo responsável decide a etapa — mais de um id = multiaprovação (todos precisam decidir). Mutuamente exclusivo com papel_id.';

COMMIT;
