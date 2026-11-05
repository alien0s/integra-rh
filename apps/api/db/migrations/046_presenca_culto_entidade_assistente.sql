-- =============================================================================
-- 046_presenca_culto_entidade_assistente.sql
-- Tesoureiro Assistente por entidade (último degrau da escada do líder).
-- A coluna entities.grupo não serve: a RADOAM é do grupo ACeAm, mas o
-- assistente dela é outro. Por isso o mapeamento é entidade -> assistente.
-- Entidade sem linha aqui: não tem esse degrau (vai direto pro final).
-- =============================================================================

BEGIN;

CREATE TABLE presenca_culto_entidade_assistente (
  entity_id      UUID PRIMARY KEY REFERENCES entities(id) ON DELETE CASCADE,
  assistente_id  UUID NOT NULL REFERENCES users(id),
  atualizado_por UUID REFERENCES users(id),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mapeamento inicial
INSERT INTO presenca_culto_entidade_assistente (entity_id, assistente_id)
SELECT e.id, u.id
  FROM entities e
  JOIN users u ON u.nome ILIKE 'Lucas da Silva Santana%'
 WHERE e.nome ILIKE 'ACeAm'
    OR e.nome ILIKE 'Contro%Igrejas'
    OR e.nome ILIKE 'NT Store'
UNION ALL
SELECT e.id, u.id
  FROM entities e
  JOIN users u ON u.nome ILIKE 'Dalmo Dilson Pereira%'
 WHERE e.nome ILIKE 'RADOAM';

COMMIT;

-- Conferência: tem que listar 4 linhas
SELECT e.nome AS entidade, u.nome AS assistente
  FROM presenca_culto_entidade_assistente ea
  JOIN entities e ON e.id = ea.entity_id
  JOIN users u ON u.id = ea.assistente_id
 ORDER BY u.nome, e.nome;