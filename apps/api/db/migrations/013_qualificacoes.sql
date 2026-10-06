-- 013_qualificacoes.sql
-- Módulo de Cursos e Qualificações: o próprio colaborador cadastra formação
-- acadêmica, cursos/certificações e idiomas; o RH aprova cada registro.
--
-- IMPORTANTE (regra de negócio): a aprovação (status/motivo_recusa) é só para
-- a tela do RH moderar as entradas — o colaborador (e quem mais visualizar o
-- perfil) NUNCA vê "pendente"/"recusado" na tela. O front pode, no máximo,
-- usar `status = 'APROVADO'` para decidir se mostra um selo de "verificado"
-- (ex.: "Diploma verificado"), mas sem expor o fluxo de aprovação em si.
-- Mesmo padrão de aprovação já usado em ferias_solicitacoes (008_ferias.sql):
-- status PENDENTE/APROVADO/RECUSADO + aprovado_por + decidido_em + motivo_recusa
-- obrigatório quando RECUSADO.

/* ── Formação acadêmica ──────────────────────────────────────────────────
   Graduação, pós, MBA, mestrado, doutorado — E também curso técnico, que
   faltava no front original (pedido explícito para incluir aqui). */

CREATE TABLE IF NOT EXISTS qualificacoes_academicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Nível do curso. TECNICO incluído agora (não existia no mock do front).
  nivel VARCHAR(20) NOT NULL,
  CONSTRAINT qualificacoes_academicas_nivel_valido
    CHECK (nivel IN ('TECNICO', 'GRADUACAO', 'POS_GRADUACAO', 'MBA', 'MESTRADO', 'DOUTORADO')),

  -- Curso/área (ex.: "Administração de Empresas"). O front monta o título
  -- exibido ("Graduação em Administração de Empresas") a partir de nivel + curso.
  curso VARCHAR(255) NOT NULL,
  instituicao VARCHAR(255) NOT NULL,

  ano_inicio SMALLINT NOT NULL,
  CONSTRAINT qualificacoes_academicas_ano_inicio_valido
    CHECK (ano_inicio BETWEEN 1950 AND 2100),
  -- NULL = em andamento (ainda cursando, front mostra "Presente").
  ano_fim SMALLINT,
  CONSTRAINT qualificacoes_academicas_ano_fim_valido
    CHECK (ano_fim IS NULL OR ano_fim >= ano_inicio),

  situacao VARCHAR(20) NOT NULL DEFAULT 'EM_ANDAMENTO',
  CONSTRAINT qualificacoes_academicas_situacao_valida
    CHECK (situacao IN ('EM_ANDAMENTO', 'CONCLUIDO', 'TRANCADO')),

  -- Comprovante/diploma anexado (chave do storage ou URL) — ícone de
  -- documento no card. Opcional.
  anexo_url TEXT,

  -- Aprovação do RH (ver nota no topo do arquivo — invisível pro colaborador).
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  CONSTRAINT qualificacoes_academicas_status_valido
    CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO')),
  aprovado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMP WITH TIME ZONE,
  motivo_recusa TEXT,
  CONSTRAINT qualificacoes_academicas_recusa_com_motivo
    CHECK (status <> 'RECUSADO' OR motivo_recusa IS NOT NULL),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qualificacoes_academicas_user_id ON qualificacoes_academicas(user_id);
CREATE INDEX idx_qualificacoes_academicas_status ON qualificacoes_academicas(status);

COMMENT ON TABLE qualificacoes_academicas IS 'Formação acadêmica do colaborador (técnico, graduação, pós, MBA, mestrado, doutorado), sujeita à aprovação do RH.';
COMMENT ON COLUMN qualificacoes_academicas.nivel IS 'TECNICO, GRADUACAO, POS_GRADUACAO, MBA, MESTRADO ou DOUTORADO.';
COMMENT ON COLUMN qualificacoes_academicas.ano_fim IS 'NULL = em andamento (cursando).';
COMMENT ON COLUMN qualificacoes_academicas.status IS 'Aprovação do RH (PENDENTE/APROVADO/RECUSADO) — não exibir esse status ao colaborador, só na tela do RH.';

/* ── Cursos, workshops e certificações ───────────────────────────────────
   Certificações e Cursos/workshops mescladas numa tabela só (mesma
   estrutura: nome, instituição, período, comprovante) — `tipo` diferencia
   pra que o front continue agrupando em duas seções, como no mock. */

CREATE TABLE IF NOT EXISTS qualificacoes_cursos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  tipo VARCHAR(20) NOT NULL,
  CONSTRAINT qualificacoes_cursos_tipo_valido
    CHECK (tipo IN ('CERTIFICACAO', 'CURSO', 'WORKSHOP')),

  nome VARCHAR(255) NOT NULL,
  instituicao VARCHAR(255) NOT NULL,

  -- Carga horária em horas (ex.: "40h") — normalmente só cursos/workshops
  -- preenchem; certificações costumam deixar em branco.
  carga_horaria SMALLINT,
  CONSTRAINT qualificacoes_cursos_carga_horaria_valida
    CHECK (carga_horaria IS NULL OR carga_horaria > 0),

  -- Emissão/conclusão e validade (ex.: "EMITIDO EM 2023" / "EXPIRA EM JAN. 2026").
  -- data_validade normalmente só se aplica a CERTIFICACAO.
  data_emissao DATE,
  data_validade DATE,
  CONSTRAINT qualificacoes_cursos_validade_valida
    CHECK (data_validade IS NULL OR data_emissao IS NULL OR data_validade >= data_emissao),

  -- Link/anexo do certificado ("Ver certificado").
  certificado_url TEXT,

  -- Aprovação do RH (ver nota no topo do arquivo — invisível pro colaborador).
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  CONSTRAINT qualificacoes_cursos_status_valido
    CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO')),
  aprovado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMP WITH TIME ZONE,
  motivo_recusa TEXT,
  CONSTRAINT qualificacoes_cursos_recusa_com_motivo
    CHECK (status <> 'RECUSADO' OR motivo_recusa IS NOT NULL),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qualificacoes_cursos_user_id ON qualificacoes_cursos(user_id);
CREATE INDEX idx_qualificacoes_cursos_tipo ON qualificacoes_cursos(tipo);
CREATE INDEX idx_qualificacoes_cursos_status ON qualificacoes_cursos(status);

COMMENT ON TABLE qualificacoes_cursos IS 'Certificações, cursos e workshops do colaborador (mesma estrutura, `tipo` diferencia a seção no front), sujeitos à aprovação do RH.';
COMMENT ON COLUMN qualificacoes_cursos.tipo IS 'CERTIFICACAO, CURSO ou WORKSHOP — define em qual seção o front agrupa o registro.';
COMMENT ON COLUMN qualificacoes_cursos.carga_horaria IS 'Horas do curso/workshop (ex.: 40). Geralmente vazio para certificações.';
COMMENT ON COLUMN qualificacoes_cursos.data_validade IS 'Validade/expiração — normalmente só preenchido para CERTIFICACAO.';
COMMENT ON COLUMN qualificacoes_cursos.status IS 'Aprovação do RH (PENDENTE/APROVADO/RECUSADO) — não exibir esse status ao colaborador, só na tela do RH.';

/* ── Idiomas ───────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS qualificacoes_idiomas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  idioma VARCHAR(60) NOT NULL,

  -- Nível no padrão CEFR (o mesmo usado pelo mercado: A1-C2). O front deriva
  -- o rótulo em pt-BR (Básico/Intermediário/Avançado) e o % da barra a
  -- partir deste código — não duplicar isso em outra coluna.
  nivel_cefr VARCHAR(2) NOT NULL,
  CONSTRAINT qualificacoes_idiomas_nivel_valido
    CHECK (nivel_cefr IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),

  -- Como o nível foi obtido: autodeclarado pelo colaborador, ou aferido por
  -- um teste interno (ex.: "IntegraRH Lang", visto no mock do front).
  origem_avaliacao VARCHAR(20) NOT NULL DEFAULT 'AUTODECLARADO',
  CONSTRAINT qualificacoes_idiomas_origem_valida
    CHECK (origem_avaliacao IN ('AUTODECLARADO', 'TESTE_INTERNO')),
  -- Data do teste, quando origem_avaliacao = TESTE_INTERNO.
  avaliado_em DATE,

  -- Aprovação do RH (ver nota no topo do arquivo — invisível pro colaborador).
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  CONSTRAINT qualificacoes_idiomas_status_valido
    CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO')),
  aprovado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMP WITH TIME ZONE,
  motivo_recusa TEXT,
  CONSTRAINT qualificacoes_idiomas_recusa_com_motivo
    CHECK (status <> 'RECUSADO' OR motivo_recusa IS NOT NULL),

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qualificacoes_idiomas_user_id ON qualificacoes_idiomas(user_id);
CREATE INDEX idx_qualificacoes_idiomas_status ON qualificacoes_idiomas(status);
-- Um registro por idioma por pessoa (editar em vez de duplicar).
CREATE UNIQUE INDEX idx_qualificacoes_idiomas_unico ON qualificacoes_idiomas(user_id, idioma);

COMMENT ON TABLE qualificacoes_idiomas IS 'Proficiência em idiomas do colaborador, sujeita à aprovação do RH.';
COMMENT ON COLUMN qualificacoes_idiomas.nivel_cefr IS 'Nível no padrão CEFR (A1-C2) — fonte única da verdade; rótulo e % da barra são derivados no front.';
COMMENT ON COLUMN qualificacoes_idiomas.origem_avaliacao IS 'AUTODECLARADO (o colaborador informou) ou TESTE_INTERNO (aferido por um teste, ex.: IntegraRH Lang).';
COMMENT ON COLUMN qualificacoes_idiomas.status IS 'Aprovação do RH (PENDENTE/APROVADO/RECUSADO) — não exibir esse status ao colaborador, só na tela do RH.';

/* ── updated_at automático (mesmo padrão de ferias_solicitacoes) ────────── */

CREATE OR REPLACE FUNCTION qualificacoes_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qualificacoes_academicas_updated_at_trigger
BEFORE UPDATE ON qualificacoes_academicas
FOR EACH ROW
EXECUTE FUNCTION qualificacoes_set_updated_at();

CREATE TRIGGER qualificacoes_cursos_updated_at_trigger
BEFORE UPDATE ON qualificacoes_cursos
FOR EACH ROW
EXECUTE FUNCTION qualificacoes_set_updated_at();

CREATE TRIGGER qualificacoes_idiomas_updated_at_trigger
BEFORE UPDATE ON qualificacoes_idiomas
FOR EACH ROW
EXECUTE FUNCTION qualificacoes_set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security — mesma lógica de ferias_solicitacoes (008_ferias.sql,
-- ver o comentário completo lá sobre por quê/como). 2ª tabela do piloto —
-- igual férias, a API conecta sempre como `erpuser` (dono das tabelas), e
-- abre uma transação por requisição com `set_config('app.user_id'/'app.papel',
-- ..., true)` via `rodaComoUsuario` (apps/api/src/lib/database.ts), usado em
-- todo handler de qualificacoes.routes.ts. O `GET /notificacoes` já estava
-- coberto (mesmo wrapper, por causa do JOIN com ferias_solicitacoes) — o
-- JOIN dele com estas 3 tabelas (ver listNotificacoes em lib/notificacoes.ts)
-- se beneficia de graça, sem precisar mexer em notificacoes.routes.ts de novo.
--
-- Regra própria deste módulo (diferente de férias): um registro APROVADO é
-- público pra QUALQUER autenticado (perfil de outra pessoa mostra diplomas/
-- cursos/idiomas já aprovados — ver "visão pública" em
-- qualificacoes.routes.ts). PENDENTE/RECUSADO só o dono e RH/ADMIN veem —
-- por isso a policy de leitura tem uma 3ª condição (`status = 'APROVADO'`)
-- que não depende de identidade nenhuma.
--
-- FORCE em todas — sem isso o dono da tabela (erpuser, a própria conexão da
-- API) ignora o RLS inteiro (ver aviso em 008_ferias.sql).

ALTER TABLE qualificacoes_academicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualificacoes_academicas FORCE ROW LEVEL SECURITY;
ALTER TABLE qualificacoes_cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualificacoes_cursos FORCE ROW LEVEL SECURITY;
ALTER TABLE qualificacoes_idiomas ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualificacoes_idiomas FORCE ROW LEVEL SECURITY;

/* ── qualificacoes_academicas ────────────────────────────────────────────── */

CREATE POLICY qualificacoes_academicas_leitura ON qualificacoes_academicas
  FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
    OR status = 'APROVADO'
  );

-- Criar: só o próprio dono (não existe "RH cadastra em nome de alguém" aqui,
-- diferente do registro manual de férias).
CREATE POLICY qualificacoes_academicas_criar ON qualificacoes_academicas
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

-- Atualizar (aprovar/recusar do RH, ou o dono anexando/removendo o diploma).
CREATE POLICY qualificacoes_academicas_atualizar ON qualificacoes_academicas
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );

-- Excluir: dono ou RH/ADMIN (ver excluirFormacao em lib/qualificacoes.ts).
CREATE POLICY qualificacoes_academicas_excluir ON qualificacoes_academicas
  FOR DELETE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );

/* ── qualificacoes_cursos ────────────────────────────────────────────────── */

CREATE POLICY qualificacoes_cursos_leitura ON qualificacoes_cursos
  FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
    OR status = 'APROVADO'
  );

CREATE POLICY qualificacoes_cursos_criar ON qualificacoes_cursos
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY qualificacoes_cursos_atualizar ON qualificacoes_cursos
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );

CREATE POLICY qualificacoes_cursos_excluir ON qualificacoes_cursos
  FOR DELETE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );

/* ── qualificacoes_idiomas ───────────────────────────────────────────────── */

CREATE POLICY qualificacoes_idiomas_leitura ON qualificacoes_idiomas
  FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
    OR status = 'APROVADO'
  );

CREATE POLICY qualificacoes_idiomas_criar ON qualificacoes_idiomas
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY qualificacoes_idiomas_atualizar ON qualificacoes_idiomas
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );

CREATE POLICY qualificacoes_idiomas_excluir ON qualificacoes_idiomas
  FOR DELETE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'RH'])
  );
