-- 002_user_roles.sql
-- Papel (perfil de acesso) de cada usuário. A partir da migration 010, o papel
-- é ÚNICO por usuário (users.role_id -> roles). O catálogo `roles` é criado e
-- populado na migration 010. Idempotente.
--
-- Vocabulário (codigo → descrição):
--   COLABORADOR → Colaborador (papel base padrão)
--   GESTOR      → Gestor / Gerente
--   DP          → Departamento Pessoal
--   RH          → Recursos Humanos
--   DIRETORIA   → Diretoria
--   ADMIN       → Administrador do sistema

-- Base: todo usuário sem papel definido vira COLABORADOR.
UPDATE users
SET role_id = (SELECT id FROM roles WHERE codigo = 'COLABORADOR')
WHERE role_id IS NULL;

-- Papéis específicos por usuário (sobrescrevem o base).
UPDATE users u
SET role_id = r.id
FROM roles r
JOIN (VALUES
  ('ana.souza@adventistas.org',     'RH'),
  ('camila.rocha@adventistas.org',  'GESTOR'),
  ('fernanda.lima@adventistas.org', 'DP'),
  ('bruno.martins@adventistas.org', 'DIRETORIA'),
  ('diego.almeida@adventistas.org', 'ADMIN')
) AS m(email, codigo) ON m.codigo = r.codigo
WHERE u.email = m.email;
