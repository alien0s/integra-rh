
CREATE TABLE IF NOT EXISTS vr_mes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes INTEGER NOT NULL,
  CONSTRAINT mes_valido CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL,
  fechado BOOLEAN NOT NULL DEFAULT FALSE,
  -- Valor diário padrão do benefício
  valor_diario NUMERIC(10,2) NOT NULL,
  -- Valor diário específico para categoria Aprendiz/Estagiário
  valor_diario_aprendiz NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_vr_mes_mes_ano_unico ON vr_mes (mes, ano);

COMMENT ON TABLE vr_mes IS 'Cadastro mensal do benefício VR: mês/ano de referência e valores diários';
COMMENT ON COLUMN vr_mes.valor_diario IS 'Valor diário padrão do benefício';
COMMENT ON COLUMN vr_mes.valor_diario_aprendiz IS 'Valor diário para categoria Aprendiz/Estagiário';
COMMENT ON COLUMN vr_mes.fechado IS 'Indica se o fechamento do mês já foi processado (bloqueia novos lançamentos retroativos)';


-- A quantidade-base de dias (dias-base) = COUNT(vr_dia_elegivel) do mês.

CREATE TABLE IF NOT EXISTS vr_dia_elegivel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  vr_mes_id UUID NOT NULL REFERENCES vr_mes(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vr_dia_elegivel_vr_mes_id ON vr_dia_elegivel(vr_mes_id);
CREATE UNIQUE INDEX idx_vr_dia_elegivel_data_unica ON vr_dia_elegivel (vr_mes_id, data);

COMMENT ON TABLE vr_dia_elegivel IS 'Calendário de dias elegíveis ao benefício VR em um determinado mês';


-- dias_vr = dias_base + qtd_extra - qtd_desconto (nunca negativo)
-- valor_a_receber = dias_vr * valor_diario (ou valor_diario_aprendiz)

-- ATUALIZADO (pós-010 original, sem migration própria na época — corrigido
-- aqui em 2026-10 pra documentar o schema real): a referência à pessoa
-- deixou de ser id_aps (APS, sem FK local) e virou user_id (FK local de
-- verdade pra users.id). O código (lib/vr.service.ts, lib/vr.export.ts) já
-- usa só user_id — não há mais nenhuma referência a id_aps no app.
CREATE TABLE IF NOT EXISTS vr_registro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  vr_mes_id UUID NOT NULL REFERENCES vr_mes(id),
  qtd_desconto INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT qtd_desconto_nao_negativa CHECK (qtd_desconto >= 0),
  qtd_extra INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT qtd_extra_nao_negativa CHECK (qtd_extra >= 0),
  dias_vr INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT dias_vr_nao_negativo CHECK (dias_vr >= 0),
  valor_a_receber NUMERIC(10,2) NOT NULL DEFAULT 0,
  fechado_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vr_registro_vr_mes_id ON vr_registro(vr_mes_id);
CREATE INDEX idx_vr_registro_user_id ON vr_registro(user_id);
CREATE UNIQUE INDEX idx_vr_registro_pessoa_mes_unico ON vr_registro (user_id, vr_mes_id);

COMMENT ON TABLE vr_registro IS 'Resultado do fechamento mensal do benefício VR por pessoa';
COMMENT ON COLUMN vr_registro.user_id IS 'Pessoa (FK users.id) a que este fechamento se refere.';
COMMENT ON COLUMN vr_registro.dias_vr IS 'Dias finais do benefício: dias_base + qtd_extra - qtd_desconto (nunca negativo)';

-- Regra de excedente (confirmada com o negócio): FIFO — lançamentos mais
-- ANTIGOS (data_desconto) são aplicados primeiro. O que exceder a
-- quantidade de dias disponíveis no mês fica pendente e migra para o mês
-- seguinte via atualização de mes_descontar_valor_id.

-- ATUALIZADO (ver nota acima em vr_registro): id_aps_desconto virou user_id
-- (FK local de verdade pra users.id). `criado_por` foi adicionado depois,
-- em 020_vr_lancamento_criado_por.sql (quem lançou, não a quem se refere).
CREATE TABLE IF NOT EXISTS vr_lancamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  -- Mês em que o lançamento deve ser considerado no fechamento
  mes_descontar_valor_id UUID NOT NULL REFERENCES vr_mes(id),
  tipo_lancamento VARCHAR(10) NOT NULL,
  CONSTRAINT tipo_lancamento_valido CHECK (tipo_lancamento IN ('DESCONTO', 'EXTRA')),
  data_desconto DATE NOT NULL,
  motivo VARCHAR(255),
  desconto_aplicado BOOLEAN NOT NULL DEFAULT FALSE,
  data_aplicacao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Cobre a consulta do fechamento: pendentes de um mês/pessoa, mais antigos primeiro (FIFO)
CREATE INDEX idx_vr_lancamento_fechamento
  ON vr_lancamento (mes_descontar_valor_id, user_id, desconto_aplicado, data_desconto);

COMMENT ON TABLE vr_lancamento IS 'Lançamentos de desconto/extra do benefício VR, aplicados por ordem FIFO (mais antigos primeiro) no fechamento';
COMMENT ON COLUMN vr_lancamento.user_id IS 'Pessoa (FK users.id) a que este lançamento se refere.';
COMMENT ON COLUMN vr_lancamento.mes_descontar_valor_id IS 'Mês (vr_mes) em que este lançamento deve ser considerado no fechamento';
COMMENT ON COLUMN vr_lancamento.desconto_aplicado IS 'Marca se o lançamento já foi consumido em um fechamento, evitando reaplicação';

-- ──────────────────────────────────────────────────────────────────────────
-- Row Level Security — mesma lógica de ferias_solicitacoes/qualificacoes_*
-- (ver o comentário completo em 008_ferias.sql). 3º módulo do piloto.
--
-- DIFERENÇA dos módulos anteriores: aqui NÃO existe autoatendimento — nenhum
-- COLABORADOR acessa o próprio VR pela API (ver exigirAcessoVr em
-- vr.routes.ts: só DP, COORDENADOR DP, ASSISTENTE, TESOUREIRO e ADMIN
-- tocam qualquer rota de VR). Por isso as policies abaixo são só por PAPEL,
-- sem a condição "OR user_id = dono" que os módulos anteriores tinham —
-- vr_registro/vr_lancamento até têm um user_id (a pessoa a que o
-- lançamento/fechamento se refere), mas ele nunca é comparado com quem fez
-- a requisição, porque não há essa noção de "dono vendo o próprio" aqui.
--
-- `criarVrMes`, `editarVrMes`, `criarLancamentosEmLote` e
-- `fecharVrPorEntidade` (lib/vr.service.ts) abrem sua PRÓPRIA transação
-- (`sql.begin()`) pra atomicidade — por isso não usam `rodaComoUsuario`
-- (que também abriria uma transação, e aninhar `.begin()` não funciona).
-- Elas chamam `setarIdentidadeNaTransacao(sql, usuario)` como a 1ª linha de
-- dentro do próprio `sql.begin(async (sql) => {...})`. As demais rotas de
-- `vr.routes.ts` (leituras simples, cancelar lançamento, exportar) usam
-- `rodaComoUsuario` normalmente. Ver apps/api/src/lib/database.ts.
--
-- FORCE em todas — sem isso o dono da tabela (erpuser) ignora o RLS inteiro.

ALTER TABLE vr_mes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_mes FORCE ROW LEVEL SECURITY;
ALTER TABLE vr_dia_elegivel ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_dia_elegivel FORCE ROW LEVEL SECURITY;
ALTER TABLE vr_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_registro FORCE ROW LEVEL SECURITY;
ALTER TABLE vr_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_lancamento FORCE ROW LEVEL SECURITY;

-- Papéis liberados pro VR (mesmo conjunto de PAPEIS_LIBERADOS_VR em
-- vr.routes.ts) — ADMIN sempre passa, mesma convenção dos outros módulos.
CREATE POLICY vr_mes_acesso ON vr_mes
  FOR ALL
  USING (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']))
  WITH CHECK (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']));

CREATE POLICY vr_dia_elegivel_acesso ON vr_dia_elegivel
  FOR ALL
  USING (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']))
  WITH CHECK (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']));

CREATE POLICY vr_registro_acesso ON vr_registro
  FOR ALL
  USING (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']))
  WITH CHECK (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']));

CREATE POLICY vr_lancamento_acesso ON vr_lancamento
  FOR ALL
  USING (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']))
  WITH CHECK (current_setting('app.papel', true) = ANY (ARRAY['ADMIN', 'DP', 'COORDENADOR DP', 'ASSISTENTE', 'TESOUREIRO']));
