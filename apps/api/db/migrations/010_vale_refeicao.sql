
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

CREATE TABLE IF NOT EXISTS vr_registro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referência à pessoa no sistema APS (id inteiro, sem FK local — ver nota no topo)
  id_aps INTEGER NOT NULL,
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
CREATE INDEX idx_vr_registro_id_aps ON vr_registro(id_aps);
CREATE UNIQUE INDEX idx_vr_registro_pessoa_mes_unico ON vr_registro (id_aps, vr_mes_id);

COMMENT ON TABLE vr_registro IS 'Resultado do fechamento mensal do benefício VR por pessoa';
COMMENT ON COLUMN vr_registro.id_aps IS 'Id da pessoa na tabela pessoa do sistema APS (fonte externa, sem FK local)';
COMMENT ON COLUMN vr_registro.dias_vr IS 'Dias finais do benefício: dias_base + qtd_extra - qtd_desconto (nunca negativo)';

-- Regra de excedente (confirmada com o negócio): FIFO — lançamentos mais
-- ANTIGOS (data_desconto) são aplicados primeiro. O que exceder a
-- quantidade de dias disponíveis no mês fica pendente e migra para o mês
-- seguinte via atualização de mes_descontar_valor_id.

CREATE TABLE IF NOT EXISTS vr_lancamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Referência à pessoa no sistema APS (mesma observação de vr_registro.id_aps)
  id_aps_desconto INTEGER NOT NULL,
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
  ON vr_lancamento (mes_descontar_valor_id, id_aps_desconto, desconto_aplicado, data_desconto);

COMMENT ON TABLE vr_lancamento IS 'Lançamentos de desconto/extra do benefício VR, aplicados por ordem FIFO (mais antigos primeiro) no fechamento';
COMMENT ON COLUMN vr_lancamento.id_aps_desconto IS 'Id da pessoa na tabela pessoa do sistema APS (fonte externa, sem FK local)';
COMMENT ON COLUMN vr_lancamento.mes_descontar_valor_id IS 'Mês (vr_mes) em que este lançamento deve ser considerado no fechamento';
COMMENT ON COLUMN vr_lancamento.desconto_aplicado IS 'Marca se o lançamento já foi consumido em um fechamento, evitando reaplicação';
