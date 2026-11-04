-- 030_modulos_visibilidade.sql
-- Visibilidade de módulos (sidebar + acesso à rota) por papel, configurável
-- pelo ADMIN na tela Tabelas (ver ModulosVisibilidadeAdmin.tsx e
-- GET/PATCH /tabelas/modulos-visibilidade). Tabela ESPARSA: só guarda
-- exceções — ausência de linha para um (módulo, papel) = visível (default),
-- mesma semântica de entities.participa_vr/users.participa_vr. Sem isso,
-- qualquer papel novo (roles é dinâmica — "COORDENADOR DP" nem está no seed
-- de 004_roles.sql) ou módulo novo no sidebar quebraria por falta de linha.
--
-- Sem RLS: catálogo/config puro, sem dono de linha — mesma convenção de
-- roles/setor/functions (002, 003, 004), controle de acesso só na rota
-- (exigirPapeis() em tabelas.routes.ts). Sem updated_at/trigger, pelo mesmo
-- motivo (roles/setor/functions também não têm).
--
-- ADMIN sempre vê/acessa tudo, independente do conteúdo desta tabela — ver
-- calcularModulosRestritos() em auth.routes.ts e moduloLiberado() no front.

CREATE TABLE IF NOT EXISTS modulos_visibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_codigo VARCHAR(50) NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  visivel BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_modulos_visibilidade_modulo_role
  ON modulos_visibilidade(modulo_codigo, role_id);

COMMENT ON TABLE modulos_visibilidade IS
  'Exceções de visibilidade/acesso por papel, por módulo (sidebar + rota). Ausência de linha = visível (default). modulo_codigo não tem FK: o catálogo de módulos vive no front (AppSidebar.tsx).';
COMMENT ON COLUMN modulos_visibilidade.modulo_codigo IS
  'Código estável do módulo (slug da URL sem a barra, ex.: "usuarios", "tabelas", "vr", "cursos") — definido no front.';
COMMENT ON COLUMN modulos_visibilidade.visivel IS
  'Só guarda exceções: FALSE nega explicitamente; TRUE reverte uma negação anterior sem apagar a linha.';

-- Backfill: reproduz EXATAMENTE as restrições hardcoded de hoje, contra
-- `roles` via subquery (dinâmica — cobre "COORDENADOR DP" e qualquer papel
-- futuro sem precisar saber o id de antemão). Não precisa de linhas para
-- home/ferias/ponto — hoje são abertos a todos e a ausência de linha já
-- significa isso.

-- Usuários: oculto só de COLABORADOR.
INSERT INTO modulos_visibilidade (modulo_codigo, role_id, visivel)
SELECT 'usuarios', id, FALSE FROM roles WHERE codigo = 'COLABORADOR'
ON CONFLICT (modulo_codigo, role_id) DO NOTHING;

-- Tabelas: só ADMIN.
INSERT INTO modulos_visibilidade (modulo_codigo, role_id, visivel)
SELECT 'tabelas', id, FALSE FROM roles WHERE codigo <> 'ADMIN'
ON CONFLICT (modulo_codigo, role_id) DO NOTHING;

-- VR: ADMIN + DP/COORDENADOR DP/ASSISTENTE/TESOUREIRO.
INSERT INTO modulos_visibilidade (modulo_codigo, role_id, visivel)
SELECT 'vr', id, FALSE FROM roles
WHERE codigo NOT IN ('ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO')
ON CONFLICT (modulo_codigo, role_id) DO NOTHING;

-- Cursos e qualificações: ADMIN + RH (o lock de beta, PAPEIS_LIBERADOS_CURSOS_BETA,
-- continua por cima disso e fora de escopo — hoje já bloqueia todo o resto).
INSERT INTO modulos_visibilidade (modulo_codigo, role_id, visivel)
SELECT 'cursos', id, FALSE FROM roles WHERE codigo NOT IN ('ADMIN', 'RH')
ON CONFLICT (modulo_codigo, role_id) DO NOTHING;
