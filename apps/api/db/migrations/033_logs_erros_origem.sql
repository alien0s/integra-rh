-- 033_logs_erros_origem.sql
-- logs_erros (032_logs_erros.sql) só registrava erros que chegavam até o
-- app.setErrorHandler do backend — mas um erro que acontece inteiramente no
-- navegador (ex.: falha ao compactar um PDF grande demais antes do upload,
-- ver lib/pdf.ts no front) nunca passa por ali, porque a requisição nem
-- chega a sair do browser. Caso real que motivou isto: testes de upload de
-- diploma deram erro e nada apareceu no log — o erro era de compactação,
-- 100% client-side.
--
-- `origem` distingue as duas fontes. `status_http` deixa de ser obrigatório
-- porque um erro de front não tem um status HTTP de verdade (não houve
-- requisição alguma).

ALTER TABLE logs_erros ADD COLUMN IF NOT EXISTS origem VARCHAR(20) NOT NULL DEFAULT 'backend';
ALTER TABLE logs_erros
  ADD CONSTRAINT logs_erros_origem_valida CHECK (origem IN ('backend', 'frontend'));
ALTER TABLE logs_erros ALTER COLUMN status_http DROP NOT NULL;

COMMENT ON COLUMN logs_erros.origem IS
  '''backend'' (capturado pelo app.setErrorHandler) ou ''frontend'' (reportado pelo próprio navegador via POST /logs/cliente — não tem status HTTP de verdade, status_http fica NULL).';
