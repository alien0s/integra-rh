-- 001_seed_inicial.sql
-- Dados iniciais do ERP: entidade ACEAM, departamentos, funções e usuários.
-- Idempotente (ON CONFLICT DO NOTHING) — pode rodar várias vezes.
-- Obs.: emails precisam ser @adventistas.org (CHECK email_must_be_adventistas).

-- ===== Entidade =====
INSERT INTO entities (id, nome, cnpj)
VALUES ('00000000-0000-0000-0000-00000000ace1', 'ACEAM', NULL)
ON CONFLICT (id) DO NOTHING;

-- ===== Departamentos =====
INSERT INTO departments (entity_id, nome, descricao) VALUES
  ('00000000-0000-0000-0000-00000000ace1', 'Gestão de Pessoas', 'Recursos Humanos'),
  ('00000000-0000-0000-0000-00000000ace1', 'Finanças',          'Financeiro e contabilidade'),
  ('00000000-0000-0000-0000-00000000ace1', 'Educação',          'Área pedagógica'),
  ('00000000-0000-0000-0000-00000000ace1', 'Tecnologia',        'TI e sistemas'),
  ('00000000-0000-0000-0000-00000000ace1', 'Administrativo',    'Apoio administrativo')
ON CONFLICT (entity_id, nome) DO NOTHING;

-- ===== Funções =====
INSERT INTO functions (entity_id, nome, descricao, salario_base) VALUES
  ('00000000-0000-0000-0000-00000000ace1', 'Analista de RH',            NULL,  6500.00),
  ('00000000-0000-0000-0000-00000000ace1', 'Coordenador Financeiro',    NULL, 11200.00),
  ('00000000-0000-0000-0000-00000000ace1', 'Supervisora Pedagógica',    NULL,  8900.00),
  ('00000000-0000-0000-0000-00000000ace1', 'Analista de Sistemas',      NULL,  7800.00),
  ('00000000-0000-0000-0000-00000000ace1', 'Assistente Administrativo', NULL,  4200.00)
ON CONFLICT (entity_id, nome) DO NOTHING;

-- ===== Usuários =====
INSERT INTO users (
  entity_id, department_id, function_id,
  email, nome, cpf, telefone, salario, data_admissao, data_demissao, is_active
) VALUES
  (
    '00000000-0000-0000-0000-00000000ace1',
    (SELECT id FROM departments WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Gestão de Pessoas'),
    (SELECT id FROM functions   WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Analista de RH'),
    'ana.souza@adventistas.org', 'Ana Carolina Souza', '123.456.789-01', '+55 (11) 98765-4321', 6500.00, '2021-03-12', NULL, TRUE
  ),
  (
    '00000000-0000-0000-0000-00000000ace1',
    (SELECT id FROM departments WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Finanças'),
    (SELECT id FROM functions   WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Coordenador Financeiro'),
    'bruno.martins@adventistas.org', 'Bruno Martins', '987.654.321-09', '+55 (11) 99123-4567', 11200.00, '2018-08-05', '2025-06-30', FALSE
  ),
  (
    '00000000-0000-0000-0000-00000000ace1',
    (SELECT id FROM departments WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Educação'),
    (SELECT id FROM functions   WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Supervisora Pedagógica'),
    'camila.rocha@adventistas.org', 'Camila Rocha', '456.789.123-45', '+55 (11) 97777-1234', 8900.00, '2019-01-20', NULL, TRUE
  ),
  (
    '00000000-0000-0000-0000-00000000ace1',
    (SELECT id FROM departments WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Tecnologia'),
    (SELECT id FROM functions   WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Analista de Sistemas'),
    'diego.almeida@adventistas.org', 'Diego Almeida', '321.654.987-00', '+55 (11) 96543-2109', 7800.00, '2022-11-03', NULL, TRUE
  ),
  (
    '00000000-0000-0000-0000-00000000ace1',
    (SELECT id FROM departments WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Administrativo'),
    (SELECT id FROM functions   WHERE entity_id = '00000000-0000-0000-0000-00000000ace1' AND nome = 'Assistente Administrativo'),
    'fernanda.lima@adventistas.org', 'Fernanda Lima', '654.321.987-12', '+55 (11) 95432-1098', 4200.00, '2020-07-14', '2025-02-15', FALSE
  )
ON CONFLICT (entity_id, email) DO NOTHING;
