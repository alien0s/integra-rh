-- =============================================================================
-- 038_presenca_culto.sql
-- Módulo Presença no Culto (migrado do Power Apps)
--
-- Contrato de entrada (Python > Automate > banco):
--   INSERT INTO presenca_culto (codigo_aps_entidade, nome, data, hora, status, pontuacao)
--   ... ON CONFLICT (codigo_aps_entidade, data) DO NOTHING;
--   O resto (user_id, status_original, pontuacao_original) a trigger preenche.
--
-- Aprovação (resolvida na lib no momento da justificativa):
--   lider_id            = quem aprova a 1ª etapa (NULL = etapa única)
--   final_aprovador_id  = quem dá o veredito final (gerente de RH, ou Tesoureiro
--                         quando quem faltou é o próprio gerente de RH)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Calendário de cultos (RH marca os dias que contam no cálculo)
-- -----------------------------------------------------------------------------
CREATE TABLE presenca_culto_calendario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        DATE NOT NULL UNIQUE,
  observacao  TEXT,
  criado_por  UUID REFERENCES users(id),
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. Períodos de premiação (o "trimestre" do programa não é de calendário)
-- -----------------------------------------------------------------------------
CREATE TABLE presenca_culto_periodo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,                  -- ex.: '3º Trimestre 2026'
  data_inicio     DATE NOT NULL,
  data_fim        DATE NOT NULL,
  data_premiacao  DATE,
  recurso_inicio  DATE,
  recurso_fim     DATE,
  fechado         BOOLEAN NOT NULL DEFAULT FALSE, -- fechado = ranking congelado
  criado_por      UUID REFERENCES users(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ck_presenca_culto_periodo_datas CHECK (data_fim >= data_inicio),
  CONSTRAINT ck_presenca_culto_periodo_recurso CHECK (
    recurso_inicio IS NULL OR recurso_fim IS NULL OR recurso_fim >= recurso_inicio
  )
);

-- -----------------------------------------------------------------------------
-- 3. Superior do setor (quem aprova quando quem faltou é o próprio gestor do
--    setor). Ex.: setor DP -> Norma. Tabela própria do módulo pra não depender
--    de setor.manager_id, que não sabemos quem usa.
-- -----------------------------------------------------------------------------
CREATE TABLE presenca_culto_setor_superior (
  setor_id       UUID PRIMARY KEY REFERENCES setor(id) ON DELETE CASCADE,
  superior_id    UUID NOT NULL REFERENCES users(id),
  atualizado_por UUID REFERENCES users(id),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 4. Registro de presença (1 linha por pessoa por dia de culto)
-- -----------------------------------------------------------------------------
CREATE TABLE presenca_culto (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação (vem da carga)
  codigo_aps_entidade   INTEGER NOT NULL,           -- ID_APS
  user_id               UUID REFERENCES users(id),  -- resolvido pela trigger
  nome                  TEXT,                       -- Title

  -- Registro (vem da carga)
  data                  DATE NOT NULL,
  hora                  TIME,                       -- nulo quando Falta
  status                TEXT NOT NULL
                        CHECK (status IN ('Presente', 'Falta', 'Atraso', 'Justificado', 'Em Aprovação')),
  pontuacao             INTEGER NOT NULL DEFAULT 0, -- +3/+2/+1/0/-1

  -- Valor de referência pra reverter quando a justificativa é negada.
  -- Nasce igual à carga; ajuste manual do RH também atualiza.
  status_original       TEXT NOT NULL
                        CHECK (status_original IN ('Presente', 'Falta', 'Atraso')),
  pontuacao_original    INTEGER NOT NULL,
  ajustado_manualmente  BOOLEAN NOT NULL DEFAULT FALSE,

  -- Justificativa (só Falta pode ser justificada — regra na lib)
  tipo_justificativa    TEXT
                        CHECK (tipo_justificativa IN (
                          'Folga Autorizada',
                          'Atestado',
                          'Viagens a Trabalho',
                          'Férias',
                          'Treinamentos',
                          'Atividades Interna/Externa',
                          'Outros'
                        )),
  justificativa_texto   TEXT,
  justificado_por       UUID REFERENCES users(id),  -- a pessoa ou o líder por ela
  justificado_em        TIMESTAMPTZ,

  -- Anexo (foto, PDF ou documento — MinIO)
  anexo_path            TEXT,
  anexo_nome            TEXT,
  anexo_mime            TEXT,

  -- 1ª etapa: líder (gestor do setor > superior do setor > Tesoureiro Assistente)
  lider_id              UUID REFERENCES users(id),
  status_lider          TEXT CHECK (status_lider IN ('Aprovada', 'Negada')),
  comentario_lider      TEXT,
  lider_em              TIMESTAMPTZ,

  -- Etapa final: gerente de RH (ou Tesoureiro)
  final_aprovador_id    UUID REFERENCES users(id),
  status_final          TEXT CHECK (status_final IN ('Aprovada', 'Negada')),
  comentario_final      TEXT,
  final_em              TIMESTAMPTZ,

  -- Flags de cálculo
  segunda_chance        BOOLEAN NOT NULL DEFAULT FALSE, -- líder já devolveu uma vez
  descontar_no_ranking  BOOLEAN NOT NULL DEFAULT FALSE, -- dia neutro pra essa pessoa

  criado_em             TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_presenca_culto_pessoa_dia UNIQUE (codigo_aps_entidade, data)
);

CREATE INDEX idx_presenca_culto_data      ON presenca_culto (data);
CREATE INDEX idx_presenca_culto_user_data ON presenca_culto (user_id, data);

-- Fila do líder: pendente e ainda sem decisão dele
CREATE INDEX idx_presenca_culto_fila_lider ON presenca_culto (lider_id)
  WHERE status = 'Em Aprovação' AND status_lider IS NULL;

-- Fila final: pendente, sem decisão final (a lib filtra quem já passou do líder)
CREATE INDEX idx_presenca_culto_fila_final ON presenca_culto (final_aprovador_id)
  WHERE status = 'Em Aprovação' AND status_final IS NULL;

-- -----------------------------------------------------------------------------
-- 5. Trigger: resolve user_id pelo código APS, guarda o original, atualiza data
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION presenca_culto_before_write()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.status_original    := COALESCE(NEW.status_original, NEW.status);
    NEW.pontuacao_original := COALESCE(NEW.pontuacao_original, NEW.pontuacao);

    IF NEW.user_id IS NULL THEN
      SELECT u.id INTO NEW.user_id
        FROM users u
       WHERE u.codigo_aps_entidade = NEW.codigo_aps_entidade
       LIMIT 1;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.codigo_aps_entidade IS DISTINCT FROM OLD.codigo_aps_entidade
       OR NEW.user_id IS NULL THEN
      SELECT u.id INTO NEW.user_id
        FROM users u
       WHERE u.codigo_aps_entidade = NEW.codigo_aps_entidade
       LIMIT 1;
    END IF;

    NEW.atualizado_em := now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_presenca_culto_before_write
  BEFORE INSERT OR UPDATE ON presenca_culto
  FOR EACH ROW
  EXECUTE FUNCTION presenca_culto_before_write();

-- -----------------------------------------------------------------------------
-- 6. Histórico (justificativas, devoluções, decisões e ajustes manuais)
-- -----------------------------------------------------------------------------
CREATE TABLE presenca_culto_historico (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presenca_id  UUID NOT NULL REFERENCES presenca_culto(id) ON DELETE CASCADE,
  acao         TEXT NOT NULL
               CHECK (acao IN (
                 'JUSTIFICOU',
                 'LIDER_APROVOU', 'LIDER_NEGOU', 'LIDER_DEVOLVEU',
                 'FINAL_APROVOU', 'FINAL_NEGOU',
                 'AJUSTE_MANUAL'
               )),
  usuario_id   UUID REFERENCES users(id),
  comentario   TEXT,
  dados        JSONB,   -- foto do registro naquele momento (antes/depois)
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presenca_culto_historico_presenca ON presenca_culto_historico (presenca_id);

COMMIT;