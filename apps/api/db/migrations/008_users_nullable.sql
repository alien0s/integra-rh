-- 008_users_nullable.sql
-- Campos preenchidos manualmente pelo RH após o 1º login via SSO tornam-se opcionais.
-- O 'nome' continua NOT NULL, pois vem do perfil da Microsoft no login.

ALTER TABLE users
  ALTER COLUMN entity_id     DROP NOT NULL,
  ALTER COLUMN department_id DROP NOT NULL,
  ALTER COLUMN function_id   DROP NOT NULL,
  ALTER COLUMN data_admissao DROP NOT NULL;
