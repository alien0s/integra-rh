-- 012_rename_departments_para_setor.sql
-- Migra em cima de um banco onde 002/006 já rodaram na versão antiga
-- (tabela `departments`, coluna `users.department_id`). As migrations
-- 002_setor.sql e 006_users.sql já foram editadas para refletir o nome novo
-- (`setor`/`setor_id`) — isso aqui só converte o schema já existente,
-- preservando os dados. Rodar uma única vez.

ALTER TABLE departments RENAME TO setor;
ALTER TABLE setor DROP COLUMN IF EXISTS descricao;
ALTER INDEX IF EXISTS idx_departments_nome RENAME TO idx_setor_nome;

COMMENT ON TABLE setor IS 'Setores do ERP (independentes de entidade). Só nome — sem descrição.';

ALTER TABLE users RENAME COLUMN department_id TO setor_id;
ALTER INDEX IF EXISTS idx_users_department_id RENAME TO idx_users_setor_id;
