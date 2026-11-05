-- =============================================================================
-- 039_presenca_culto_codigo_aps_texto.sql
-- users.codigo_aps_entidade é VARCHAR; a 038 criou a coluna como INTEGER e a
-- trigger quebraria na comparação. Troca pra VARCHAR e normaliza com TRIM.
-- =============================================================================

BEGIN;

ALTER TABLE presenca_culto
  ALTER COLUMN codigo_aps_entidade TYPE VARCHAR
  USING codigo_aps_entidade::varchar;

CREATE OR REPLACE FUNCTION presenca_culto_before_write()
RETURNS TRIGGER AS $$
BEGIN
  -- A carga pode mandar número ou texto com espaço: normaliza sempre
  NEW.codigo_aps_entidade := TRIM(NEW.codigo_aps_entidade);

  IF TG_OP = 'INSERT' THEN
    NEW.status_original    := COALESCE(NEW.status_original, NEW.status);
    NEW.pontuacao_original := COALESCE(NEW.pontuacao_original, NEW.pontuacao);

    IF NEW.user_id IS NULL THEN
      SELECT u.id INTO NEW.user_id
        FROM users u
       WHERE TRIM(u.codigo_aps_entidade) = NEW.codigo_aps_entidade
       LIMIT 1;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.codigo_aps_entidade IS DISTINCT FROM OLD.codigo_aps_entidade
       OR NEW.user_id IS NULL THEN
      SELECT u.id INTO NEW.user_id
        FROM users u
       WHERE TRIM(u.codigo_aps_entidade) = NEW.codigo_aps_entidade
       LIMIT 1;
    END IF;

    NEW.atualizado_em := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;