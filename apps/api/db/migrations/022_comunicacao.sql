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
