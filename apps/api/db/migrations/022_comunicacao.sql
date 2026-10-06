-- comunicacao_module.sql
-- Módulo M5 — Comunicação
-- comunicando, comunicando

CREATE TABLE IF NOT EXISTS comunicados (
    id              SERIAL PRIMARY KEY,
    titulo          VARCHAR(200) NOT NULL,
    descricao       TEXT NOT NULL,

    criado_por      UUID NOT NULL REFERENCES users(id),
    criado_em       TIMESTAMP NOT NULL DEFAULT now(),

    status          VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO'
                    CHECK (status IN (
                        'RASCUNHO',
                        'AGUARDANDO_APROVACAO',
                        'APROVADO',
                        'REJEITADO',
                        'PUBLICADO',
                        'ENCERRADO',
                        'REMOVIDO'
                    )),

    aprovado_por    UUID REFERENCES users(id),
    aprovado_em     TIMESTAMP,
    motivo_rejeicao TEXT,

    removido_por    UUID REFERENCES users(id),
    removido_em     TIMESTAMP,

    data_inicio     DATE NOT NULL,
    data_fim        DATE NOT NULL,

    recorrente      BOOLEAN NOT NULL DEFAULT false,
    dia_semana      SMALLINT CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo ... 6=sábado, só usado se recorrente=true

    anexo_url       TEXT,
    anexo_tipo      VARCHAR(20) CHECK (anexo_tipo IN ('IMAGEM', 'PDF')),

    updated_at      TIMESTAMP NOT NULL DEFAULT now(),

    CONSTRAINT chk_periodo_valido CHECK (data_fim >= data_inicio),
    CONSTRAINT chk_dia_semana_recorrente CHECK (
        (recorrente = true AND dia_semana IS NOT NULL) OR
        (recorrente = false AND dia_semana IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS comunicado_publicacoes (
    id              SERIAL PRIMARY KEY,
    comunicado_id   INTEGER NOT NULL REFERENCES comunicados(id) ON DELETE CASCADE,

    publicado_em    TIMESTAMP NOT NULL DEFAULT now(),
    expira_em       TIMESTAMP NOT NULL,

    encerrado_manualmente BOOLEAN NOT NULL DEFAULT false,
    encerrado_por         UUID REFERENCES users(id),
    encerrado_em          TIMESTAMP,

    created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicados_status ON comunicados(status);
CREATE INDEX IF NOT EXISTS idx_comunicados_recorrente ON comunicados(recorrente) WHERE recorrente = true;
CREATE INDEX IF NOT EXISTS idx_comunicado_publicacoes_ativo ON comunicado_publicacoes(comunicado_id, expira_em);

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security — mesma lógica dos outros módulos (ver o comentário
-- completo em 008_ferias.sql). 4º módulo do piloto.
--
-- `comunicados`: o criador sempre vê/edita o próprio (rascunho, aguardando
-- aprovação, rejeitado...); RH/ADMIN vê e modera qualquer um (aprovar/
-- rejeitar/remover, ver podeAprovarOuRejeitar/podeRemover em
-- comunicacao.regras.ts); PUBLICADO/ENCERRADO é público pra qualquer
-- autenticado (mural, e já aprovado — mesma regra usada na correção do IDOR
-- de GET /comunicados/:id/anexo). Não existe DELETE de verdade neste módulo
-- (remover = UPDATE status='REMOVIDO'), então não há policy de DELETE —
-- fica negado por padrão.
--
-- `comunicado_publicacoes`: tabela só de rastro (quando publicou/expira),
-- nunca lida pelo app — escrita só acontece quando RH/ADMIN publica/aprova/
-- remove (criarPublicacao e o UPDATE em removerComunicado, ambos em
-- comunicacao.ts), nunca pelo criador original. Por isso é só por papel,
-- sem condição de dono.
--
-- `encerrarVencidos` (comunicacao.ts) roda num cron job 1x/dia
-- (comunicacao.cron.ts), fora de qualquer requisição HTTP — por isso usa
-- `rodaComoUsuario` com uma identidade "de sistema" (papel ADMIN), mesma
-- convenção do script test-vr.ts.
--
-- FORCE em ambas — sem isso o dono da tabela (erpuser) ignora o RLS inteiro.

ALTER TABLE comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicados FORCE ROW LEVEL SECURITY;
ALTER TABLE comunicado_publicacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comunicado_publicacoes FORCE ROW LEVEL SECURITY;

CREATE POLICY comunicados_leitura ON comunicados
  FOR SELECT
  USING (
    criado_por::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
    OR status IN ('PUBLICADO', 'ENCERRADO')
  );

-- Criar: qualquer papel exceto COLABORADOR (ver podeCriarComunicado), e só
-- em nome de si mesmo (criado_por = quem está pedindo).
CREATE POLICY comunicados_criar ON comunicados
  FOR INSERT
  WITH CHECK (
    criado_por::text = current_setting('app.user_id', true)
    AND current_setting('app.papel', true) <> 'COLABORADOR'
  );

-- Atualizar (aprovar/rejeitar/remover do RH/ADMIN, ou o criador trocando o
-- próprio anexo): dono ou RH/ADMIN.
CREATE POLICY comunicados_atualizar ON comunicados
  FOR UPDATE
  USING (
    criado_por::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  )
  WITH CHECK (
    criado_por::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );

CREATE POLICY comunicado_publicacoes_acesso ON comunicado_publicacoes
  FOR ALL
  USING (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH']))
  WITH CHECK (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH']));
