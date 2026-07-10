-- 002_user_roles.sql
-- Papéis (roles) atribuídos aos usuários. A tabela user_roles é de atribuição
-- (user_id + role_name), então este seed liga papéis aos usuários do 001_seed_inicial.
-- Idempotente: ON CONFLICT (user_id, role_name) DO NOTHING (idx_user_roles_unique).
--
-- Vocabulário de role_name (código → descrição):
--   COLABORADOR → Colaborador (papel base, todos têm)
--   GESTOR      → Gestor / Gerente
--   DP          → Departamento Pessoal
--   RH          → Recursos Humanos
--   DIRETORIA   → Diretoria
--   ADMIN       → Administrador do sistema

-- Papel base: todo usuário é COLABORADOR.
INSERT INTO user_roles (user_id, role_name)
SELECT id, 'COLABORADOR' FROM users
ON CONFLICT (user_id, role_name) DO NOTHING;

-- Papéis específicos por usuário (cobrem os demais 5 papéis).
INSERT INTO user_roles (user_id, role_name)
SELECT u.id, r.role_name
FROM users u
JOIN (VALUES
  ('ana.souza@adventistas.org',     'RH'),
  ('camila.rocha@adventistas.org',  'GESTOR'),
  ('fernanda.lima@adventistas.org', 'DP'),
  ('bruno.martins@adventistas.org', 'DIRETORIA'),
  ('diego.almeida@adventistas.org', 'ADMIN')
) AS r(email, role_name) ON u.email = r.email
ON CONFLICT (user_id, role_name) DO NOTHING;
