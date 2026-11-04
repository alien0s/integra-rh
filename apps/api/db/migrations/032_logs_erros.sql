-- 032_logs_erros.sql
-- Log de erros que nenhuma rota reconheceu e tratou, para o admin/dev ter
-- visibilidade de falhas que hoje só apareciam no terminal (pino) e
-- desapareciam dali — caso motivador: upload de diploma falhando no MinIO
-- sem nenhum rastro visível (qualificacoes.routes.ts, POST
-- /qualificacoes/formacoes/:id/anexo, sem try/catch ao redor de
-- uploadObject). Alimentada por um único ponto: o app.setErrorHandler
-- global em app.ts (ver lib/logs.ts) — cobre qualquer rota, não só esta.
--
-- Erros de validação/regra de negócio já tratados pelas rotas (ex.: "já
-- existe", "sem permissão") NÃO entram aqui de propósito — a própria rota
-- já responde com uma mensagem amigável e retorna antes de chegar no
-- setErrorHandler, então nunca passa por aqui. O que SOBRA pra esta tabela
-- não é filtrado por status HTTP: tentamos só >= 500 a princípio, mas isso
-- escondia casos reais (ex.: @fastify/multipart responde 413 quando o
-- diploma passa do limite de tamanho, e nenhuma rota trata esse erro
-- especificamente) — status >= 500 não é um bom proxy pra "inesperado", só
-- chegar até aqui já é.
--
-- Sem RLS: tabela 100% admin-only, acessada por uma única rota deliberada
-- (GET /logs, exigirPapeis() = só ADMIN) — diferente de tabelas como
-- qualificacoes_academicas/ferias_solicitacoes, não há "dono de linha" por
-- usuário final, então o controle de acesso fica na camada de rota, não em
-- policy de banco.

CREATE TABLE IF NOT EXISTS logs_erros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 1º segmento do caminho da requisição (ex.: "qualificacoes", "ferias"),
  -- derivado automaticamente — nenhuma rota precisa se marcar manualmente.
  modulo VARCHAR(60) NOT NULL,

  -- Método + caminho da rota (ex.: "POST /qualificacoes/formacoes/:id/anexo"),
  -- para saber exatamente qual chamada falhou, não só o módulo.
  rota VARCHAR(255) NOT NULL,

  -- error.code (ex.: código do Postgres '23503'), error.name, ou o status
  -- HTTP — o que estiver disponível no erro lançado; 'ERRO_DESCONHECIDO' se
  -- nada estiver disponível.
  codigo VARCHAR(50) NOT NULL DEFAULT 'ERRO_DESCONHECIDO',

  -- Status HTTP resolvido (quase sempre >= 500, mas não só — ex.: 413 do
  -- @fastify/multipart quando o anexo passa do limite também cai aqui).
  -- Guardado à parte do texto em `codigo` para colorir no front sem precisar
  -- parsear string.
  status_http SMALLINT NOT NULL DEFAULT 500,

  mensagem TEXT NOT NULL,
  stack TEXT,

  -- Usuário autenticado no momento do erro. Pode ser NULL (falha antes da
  -- autenticação terminar, ou auth desativada). Nome/e-mail ficam copiados
  -- aqui (não só o FK) para o log continuar legível mesmo se o usuário for
  -- excluído depois — é um registro histórico, não uma relação viva.
  usuario_id UUID REFERENCES users(id) ON DELETE SET NULL,
  usuario_nome VARCHAR(255),
  usuario_email VARCHAR(255),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_logs_erros_created_at ON logs_erros(created_at DESC);

COMMENT ON TABLE logs_erros IS
  'Log de erros que nenhuma rota reconheceu e tratou (qualquer status HTTP, não só >= 500), para diagnóstico do admin/dev — alimentado pelo app.setErrorHandler global (app.ts). Sem RLS: acesso só via GET /logs, ADMIN.';
COMMENT ON COLUMN logs_erros.modulo IS
  '1º segmento da URL da requisição (ex.: "qualificacoes"), derivado automaticamente.';
COMMENT ON COLUMN logs_erros.codigo IS
  'error.code / error.name / status HTTP — o que estiver disponível; "ERRO_DESCONHECIDO" se nenhum.';
COMMENT ON COLUMN logs_erros.usuario_nome IS
  'Cópia do nome no momento do erro — o log permanece legível mesmo se o usuário for excluído depois.';
