-- 036_remover_users_manager_id.sql
-- Aplicar após 035 e após atualizar as consultas de perfis para chefia por setor.
-- Não apaga vínculos individuais silenciosamente em outro ambiente.
BEGIN;
DO $$
DECLARE tem_vinculos BOOLEAN;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'manager_id'
  ) THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM users WHERE manager_id IS NOT NULL)' INTO tem_vinculos;
    IF tem_vinculos THEN
      RAISE EXCEPTION 'users.manager_id contém vínculos: revise a migração para chefia por setor antes de remover.';
    END IF;
  END IF;
END $$;
ALTER TABLE users DROP COLUMN IF EXISTS manager_id;
COMMIT;
