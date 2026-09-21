-- 20. COLUNA VR_LANCAMENTO.CRIADO_POR
--
-- Guarda quem lançou o desconto/extra (o usuário autenticado no momento do
-- lançamento) — pra mostrar "lançado por" nas telas de VR. Nullable porque
-- lançamentos já existentes antes dessa migration não têm essa informação.

ALTER TABLE vr_lancamento ADD COLUMN IF NOT EXISTS criado_por UUID REFERENCES users(id);

COMMENT ON COLUMN vr_lancamento.criado_por IS 'Usuário que fez o lançamento (nulo em lançamentos anteriores a essa coluna existir)';