-- 008_ferias.sql
-- Módulo de Férias/Folga: solicitações do colaborador e a decisão do gestor.
-- NÃO EXECUTADO AINDA — apenas para análise. Revise antes de aplicar via psql.
--
-- Modelo (a partir das telas do módulo):
--   - Cada linha é UMA solicitação (férias ou folga) feita por um usuário.
--   - Status: PENDENTE (aguardando), APROVADO ou RECUSADO (com justificativa).
--   - "Solicitado em" = created_at; o período é data_inicio..data_fim.
--   - O "ciclo"/período aquisitivo de referência é guardado para histórico
--     (é derivado da data de admissão, mas congelamos aqui o que valia).
--   - Saldo ("dias restantes X/30") NÃO fica aqui: é calculado a partir das
--     solicitações aprovadas + a regra de negócio.

CREATE TABLE IF NOT EXISTS ferias_solicitacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quem solicitou (colaborador).
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- FERIAS ou FOLGA (as duas abas do formulário).
  tipo VARCHAR(10) NOT NULL,
  CONSTRAINT ferias_tipo_valido CHECK (tipo IN ('FERIAS', 'FOLGA')),
  -- Período solicitado (datas corridas, inclusive).
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  CONSTRAINT ferias_periodo_valido CHECK (data_fim >= data_inicio),
  -- Quantidade de dias corridos do período (derivável de início/fim, mas
  -- guardado para facilitar listagem/relatórios). Deve ser positivo.
  dias INTEGER NOT NULL,
  CONSTRAINT ferias_dias_positivo CHECK (dias > 0),
  -- Observações do colaborador para o gestor (opcional).
  observacoes TEXT,
  -- Período aquisitivo de referência (o "ciclo" mostrado no card). Opcional.
  periodo_aquisitivo_inicio DATE,
  periodo_aquisitivo_fim DATE,
  -- Situação da solicitação (fluxo single-step nesta migration):
  --   PENDENTE → APROVADO | RECUSADO
  -- O fluxo de DUAS etapas (gestor → DP) e o CANCELADO são adicionados em
  -- 014_ferias_fluxo_aprovacao.sql (ALTER TABLE), não aqui.
  status VARCHAR(20) NOT NULL DEFAULT 'PENDENTE',
  CONSTRAINT ferias_status_valido
    CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO')),

  -- Aprovação/decisão. Nome/e-mail de quem aprovou via JOIN em users.
  aprovado_por UUID REFERENCES users(id) ON DELETE SET NULL,
  decidido_em TIMESTAMP WITH TIME ZONE,
  -- Confirmação (binário) — ex.: aprovação confirmada/efetivada.
  confirmado BOOLEAN NOT NULL DEFAULT FALSE,
  -- Justificativa obrigatória ao recusar (modal de rejeição).
  motivo_recusa TEXT,
  CONSTRAINT ferias_recusa_com_motivo
    CHECK (status <> 'RECUSADO' OR motivo_recusa IS NOT NULL),

  -- Auditoria. created_at = "solicitado em".
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para os filtros/listagens da tela (por usuário, por status, por data).
CREATE INDEX idx_ferias_user_id ON ferias_solicitacoes(user_id);
CREATE INDEX idx_ferias_status ON ferias_solicitacoes(status);
CREATE INDEX idx_ferias_data_inicio ON ferias_solicitacoes(data_inicio);

-- Mantém updated_at automaticamente em cada UPDATE (mesmo padrão de users).
CREATE OR REPLACE FUNCTION ferias_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ferias_updated_at_trigger
BEFORE UPDATE ON ferias_solicitacoes
FOR EACH ROW
EXECUTE FUNCTION ferias_set_updated_at();

-- Comentários
COMMENT ON TABLE ferias_solicitacoes IS 'Solicitações de férias/folga e a decisão do gestor.';
COMMENT ON COLUMN ferias_solicitacoes.tipo IS 'FERIAS ou FOLGA.';
COMMENT ON COLUMN ferias_solicitacoes.dias IS 'Dias corridos do período (data_fim - data_inicio + 1).';
COMMENT ON COLUMN ferias_solicitacoes.status IS 'PENDENTE, APROVADO ou RECUSADO (fluxo de 2 etapas + CANCELADO em 014).';
COMMENT ON COLUMN ferias_solicitacoes.motivo_recusa IS 'Justificativa obrigatória quando RECUSADO.';
COMMENT ON COLUMN ferias_solicitacoes.aprovado_por IS 'Quem aprovou/recusou (FK users). E-mail/nome via JOIN.';
COMMENT ON COLUMN ferias_solicitacoes.confirmado IS 'Confirmação (binário) da aprovação/efetivação.';
COMMENT ON COLUMN ferias_solicitacoes.periodo_aquisitivo_inicio IS 'Início do ciclo aquisitivo de referência (histórico).';

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security — segunda camada de autorização DENTRO do banco,
-- independente da API (que conecta sempre como `erpuser`, a mesma role pra
-- todo mundo — o Postgres não sabe sozinho "quem" está logado no site).
--
-- CONTEXTO: se a API tiver um bug de autorização — já aconteceu, ver a
-- correção de PATCH /usuarios/:usuarioId na auditoria de segurança de
-- 2026-09 — sem RLS não existe nenhuma trava no banco pra conter o estrago.
-- `ferias_solicitacoes` foi a 1ª tabela a ganhar isso (piloto): é isolada,
-- só `apps/api/src/lib/ferias.ts` e um JOIN pontual em
-- `apps/api/src/lib/notificacoes.ts` (pra saber se uma notificação de
-- férias ainda está acionável) a tocam.
--
-- COMO FUNCIONA NA PRÁTICA: a API abre uma TRANSAÇÃO por requisição nas
-- rotas que tocam esta tabela e roda `set_config('app.user_id', ..., true)`
-- / `set_config('app.papel', ..., true)` com os dados do usuário
-- autenticado (JWT) logo no início — ver `rodaComoUsuario` em
-- apps/api/src/lib/database.ts, usado em TODO handler de
-- apps/api/src/routes/ferias.routes.ts e no `GET /notificacoes` de
-- notificacoes.routes.ts. As policies abaixo leem esses dois valores com
-- `current_setting(..., true)` — o `true` faz devolver NULL (em vez de dar
-- erro) quando não foi setado, e NULL nunca bate com nada, então a ausência
-- de contexto fecha o acesso por padrão, nunca abre.
--
-- AVISO OPERACIONAL: uma consulta manual via psql direto (`erpuser`, sem
-- passar pela API) não verá NENHUMA linha desta tabela por padrão — é o
-- comportamento correto (fechado por padrão). Pra depurar manualmente:
--   SET app.papel = 'ADMIN';
--
-- ESCOPO — isto é uma REDE DE SEGURANÇA, não uma reimplementação fiel de
-- toda regra fina de negócio da API. Ex.: aqui um GESTOR enxerga TODAS as
-- solicitações, não só as da própria equipe — essa regra mais fina continua
-- sendo aplicada só pela API (ver listSolicitacoesEquipe em lib/ferias.ts).
-- O objetivo é impedir que um papel SEM nenhuma função em Férias
-- (COLABORADOR, ou qualquer papel novo que apareça no futuro) leia ou
-- altere a solicitação de outra pessoa, mesmo que uma rota futura esqueça
-- de checar isso.

ALTER TABLE ferias_solicitacoes ENABLE ROW LEVEL SECURITY;

-- IMPORTANTE: por padrão, o Postgres ISENTA o DONO da tabela do RLS (regra
-- dele, não de rolbypassrls) — e `erpuser` é o dono (criou a tabela via
-- estas migrations). Sem o FORCE abaixo, ENABLE sozinho não faria NADA pra
-- conexão da API, que usa sempre essa mesma role. FORCE fecha essa brecha.
ALTER TABLE ferias_solicitacoes FORCE ROW LEVEL SECURITY;

-- Sem nenhuma policy, o acesso já fica negado por padrão (inclusive pro
-- dono, agora que FORCE está ligado) — as policies abaixo é que ABREM os
-- casos válidos.

-- Papéis com acesso amplo (além do próprio dono), espelhando quem hoje tem
-- visão ampla na API — ver apps/api/src/routes/ferias.routes.ts:
--   GESTOR        — aprova a 1ª etapa (vê a lista geral e a "da equipe").
--   DP/COORDENADOR DP/RH — confirmam a 2ª etapa e têm a "visão geral".
--   ADMIN         — sempre passa (mesma convenção de exigirPapeis()).
CREATE POLICY ferias_leitura ON ferias_solicitacoes
  FOR SELECT
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'GESTOR', 'DP', 'COORDENADOR DP', 'RH'])
  );

-- Criar: autoatendimento (o próprio colaborador solicitando), ou
-- DP/COORDENADOR DP/RH/ADMIN registrando manualmente em nome de alguém
-- (ver registrarFeriasManual em lib/ferias.ts).
CREATE POLICY ferias_criar ON ferias_solicitacoes
  FOR INSERT
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'RH'])
  );

-- Atualizar (aprovar/recusar/confirmar/cancelar/sugerir ajuste/aceitar
-- ajuste): mesmo conjunto da leitura — quem decide sobre a solicitação quase
-- sempre não é o próprio dono.
CREATE POLICY ferias_atualizar ON ferias_solicitacoes
  FOR UPDATE
  USING (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'GESTOR', 'DP', 'COORDENADOR DP', 'RH'])
  )
  WITH CHECK (
    user_id::text = current_setting('app.user_id', true)
    OR current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'GESTOR', 'DP', 'COORDENADOR DP', 'RH'])
  );

-- Excluir: só o próprio dono — a API também exige status = CANCELADO antes
-- (ver excluirSolicitacao em lib/ferias.ts); RLS não replica essa parte, só
-- decide QUEM pode mexer na linha, não em qual status ela está.
CREATE POLICY ferias_excluir ON ferias_solicitacoes
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));
