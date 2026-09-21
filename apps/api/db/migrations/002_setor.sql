-- Setores — INDEPENDENTES de entidade (globais no ERP). Só nome, sem
-- descrição — não confundir com o conceito de "departamento" (diferente,
-- a ser criado em outra migration futura).
CREATE TABLE IF NOT EXISTS setor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_setor_nome ON setor(nome);

COMMENT ON TABLE setor IS 'Setores do ERP (independentes de entidade). Só nome — sem descrição.';
