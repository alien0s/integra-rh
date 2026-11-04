import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import Fastify from 'fastify';
import postgres from 'postgres';

import { getDatabase, rodaComoUsuario } from '../lib/database.js';
import { listNotificacoes } from '../lib/notificacoes.js';
import { feriasRoutes } from '../routes/ferias.routes.js';
import { tabelasRoutes } from '../routes/tabelas.routes.js';

/**
 * Integração com PostgreSQL descartável, sem carregar .env da aplicação.
 * Recria o schema public SOMENTE em codex_ferias_test, no localhost, com
 * usuário não-superuser para exercitar FORCE ROW LEVEL SECURITY.
 * Uso: FERIAS_TEST_DATABASE_URL=postgres://.../codex_ferias_test pnpm exec tsx src/scripts/test-ferias-fluxo.ts
 */
const connection = new URL(process.env.FERIAS_TEST_DATABASE_URL ?? 'postgres://invalid');
assert.equal(connection.pathname, '/codex_ferias_test', 'Exige banco descartável codex_ferias_test');
assert.ok(['localhost', '127.0.0.1'].includes(connection.hostname), 'Exige PostgreSQL local');
Object.assign(process.env, {
  NODE_ENV: 'test', JWT_SECRET: 'ferias-test-secret', SMTP_ENABLED: 'false', MSSQL_ENABLED: 'false',
  DB_HOST: connection.hostname, DB_PORT: connection.port || '5432', DB_NAME: 'codex_ferias_test',
  DB_USER: decodeURIComponent(connection.username), DB_PASSWORD: decodeURIComponent(connection.password),
});
const sql = postgres(connection.toString(), { max: 1, onnotice: () => {} });
const app = Fastify();
const users: Record<string, string> = {};
const migration = (name: string) => readFile(new URL(`../../db/migrations/${name}.sql`, import.meta.url), 'utf8');

try {
  const [role] = await sql<{ rolsuper: boolean }[]>`SELECT rolsuper FROM pg_roles WHERE rolname = current_user`;
  assert.equal(role.rolsuper, false, 'Testes exigem usuário sem bypass de RLS');
  await sql.unsafe(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    SET app.papel = 'ADMIN';
    CREATE TABLE roles (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), codigo TEXT UNIQUE, nome TEXT, nivel INT DEFAULT 3);
    CREATE TABLE feriados (data DATE, nome TEXT);
    CREATE TABLE entities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), grupo TEXT);
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nome TEXT, email TEXT,
      role_id UUID REFERENCES roles, manager_id UUID REFERENCES users(id), setor_id UUID, entity_id UUID REFERENCES entities,
      avatar_url TEXT, data_admissao DATE, is_active BOOLEAN DEFAULT TRUE
    );
    CREATE TABLE setor (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), nome TEXT, created_at TIMESTAMPTZ DEFAULT NOW());
    CREATE TABLE qualificacoes_academicas (id UUID PRIMARY KEY, status TEXT, anexo_url TEXT);
    CREATE TABLE qualificacoes_cursos (id UUID PRIMARY KEY, status TEXT, certificado_url TEXT);
    CREATE TABLE qualificacoes_idiomas (id UUID PRIMARY KEY, status TEXT);
  `);
  for (const name of ['008_ferias', '009_notificacoes', '011_ferias_registro_manual', '014_ferias_fluxo_aprovacao', '017_ferias_ajuste_dp', '024_ferias_excecoes', '026_ferias_sincronizacao_legado', '027_ferias_excluir_admin']) {
    await sql.unsafe(await migration(name));
  }
  for (const papel of ['GESTOR', 'RH', 'ASSISTENTE', 'COORDENADOR DP', 'DP', 'ADMIN', 'COLABORADOR']) {
    await sql`INSERT INTO roles (codigo, nome) VALUES (${papel}, ${papel}) ON CONFLICT DO NOTHING`;
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO users (nome, email, role_id)
      VALUES (${papel}, ${`${papel}@example.test`}, (SELECT id FROM roles WHERE codigo = ${papel})) RETURNING id
    `;
    users[papel] = user.id;
  }
  const [setor] = await sql<{ id: string }[]>`INSERT INTO setor (nome, gestor_id) VALUES ('Equipe', ${users.GESTOR}) RETURNING id`;
  await sql`UPDATE users SET setor_id = ${setor.id} WHERE id IN (${users.COLABORADOR}, ${users.GESTOR})`;
  const [historico] = await sql<{ id: string }[]>`
    INSERT INTO ferias_solicitacoes (user_id, tipo, data_inicio, data_fim, dias, status, aprovado_por, confirmado)
    VALUES (${users.COLABORADOR}, 'FERIAS', '2020-01-01', '2020-01-30', 30, 'APROVADO', ${users['COORDENADOR DP']}, TRUE) RETURNING id
  `;
  const [pendenteAntiga] = await sql<{ id: string }[]>`
    INSERT INTO ferias_solicitacoes (user_id, tipo, data_inicio, data_fim, dias, status)
    VALUES (${users.COLABORADOR}, 'FOLGA', CURRENT_DATE + 70, CURRENT_DATE + 70, 1, 'APROVADO_GESTOR') RETURNING id
  `;
  await sql`INSERT INTO notificacoes (destinatario_id, tipo, acao, referencia_tabela, referencia_id, requer_acao)
    VALUES (${users['COORDENADOR DP']}, 'FOLGA_AGUARDA_DP', 'Aguardando DP', 'ferias_solicitacoes', ${pendenteAntiga.id}, TRUE)`;
  await sql.unsafe(await migration('034_ferias_rh_assistente'));
  await sql.unsafe(await migration('034_ferias_rh_assistente'));

  await sql.unsafe(await migration('035_ferias_coord_dp_subordinadas'));
  await sql.unsafe(await migration('035_ferias_coord_dp_subordinadas'));

  await sql.unsafe(await migration('036_remover_users_manager_id'));
  await sql.unsafe(await migration('036_remover_users_manager_id'));

  app.decorate('authenticate', async (request) => {
    const papel = String(request.headers['x-test-papel'] ?? 'COLABORADOR');
    request.user = { id: users[papel], papelCodigo: papel, nome: papel, email: 'test@example.test', modulosBetaLiberados: ['ferias'] };
  });
  await app.register(feriasRoutes);
  await app.register(tabelasRoutes);
  await app.ready();
  const call = (papel: string, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
    app.inject({ method, url, payload, headers: { 'x-test-papel': papel } });
  const criar = async (papel = 'COLABORADOR') => {
    const result = await call(papel, 'POST', '/ferias', { tipo: 'FOLGA', dataInicio: '2030-01-07', dataFim: '2030-01-07', observacoes: null });
    assert.equal(result.statusCode, 200, result.body);
    return result.json().data as { id: string; status: string };
  };
  const decidir = async (papel: string, id: string, acao: string, expected = 200, payload?: object) => {
    const result = await call(papel, 'PATCH', `/ferias/${id}/${acao}`, payload);
    assert.equal(result.statusCode, expected, result.body);
    return result.json().data as { status: string; aprovadoRhNome?: string; aprovadoDpNome?: string };
  };
  const avisos = (papel: string) => rodaComoUsuario({ id: users[papel], papelCodigo: papel }, () => listNotificacoes(users[papel]));

  await test('Fluxo de férias com PostgreSQL e RLS', async (t) => {
    await t.test('migração reaplicável preserva decisões e encaminha fila antiga ao RH uma única vez', async () => {
      const [h] = await sql`SELECT status, aprovado_por, aprovado_rh_por FROM ferias_solicitacoes WHERE id = ${historico.id}`;
      assert.equal(h.status, 'APROVADO'); assert.equal(h.aprovado_por, users['COORDENADOR DP']); assert.equal(h.aprovado_rh_por, null);
      const [n] = await sql`SELECT COUNT(*)::int AS total FROM notificacoes WHERE tipo = 'FOLGA_AGUARDA_RH' AND referencia_id = ${pendenteAntiga.id}`;
      assert.equal(n.total, 1);
      assert.equal((await avisos('COORDENADOR DP')).find(n => n.referenciaId === pendenteAntiga.id)?.requerAcao, false);
    });
    await t.test('visão geral mantém somente as últimas férias passadas; histórico pessoal preserva as anteriores', async () => {
      const [ultima] = await sql<{ id: string }[]>`
        INSERT INTO ferias_solicitacoes (user_id, tipo, data_inicio, data_fim, dias, status, origem, confirmado, legado_evento_id)
        VALUES (${users.COLABORADOR}, 'FERIAS', '2021-01-01', '2021-01-30', 30, 'APROVADO', 'REGISTRO_MANUAL', TRUE, 1234)
        RETURNING id
      `;
      const geral = await call('GESTOR', 'GET', '/ferias');
      assert.equal(geral.statusCode, 200, geral.body);
      assert.ok(geral.json().data.some((s: { id: string }) => s.id === ultima.id));
      assert.ok(!geral.json().data.some((s: { id: string }) => s.id === historico.id));
      const pessoal = await call('COLABORADOR', 'GET', '/ferias/minhas');
      assert.equal(pessoal.statusCode, 200, pessoal.body);
      for (const id of [ultima.id, historico.id]) {
        assert.ok(pessoal.json().data.some((s: { id: string }) => s.id === id));
      }
    });
    await t.test('gerente → RH → Assistente: ordem, auditoria, notificações e tentativas fora de etapa', async () => {
      const pedido = await criar(); assert.equal(pedido.status, 'PENDENTE');
      await decidir('RH', pedido.id, 'aprovar', 403);
      await decidir('ASSISTENTE', pedido.id, 'confirmar', 404);
      await decidir('GESTOR', pedido.id, 'aprovar');
      assert.equal((await avisos('RH')).find(n => n.referenciaId === pedido.id)?.requerAcao, true);
      await decidir('GESTOR', pedido.id, 'recusar', 403, { motivo: 'Fora da etapa' });
      await decidir('COORDENADOR DP', pedido.id, 'aprovar', 403);
      await decidir('COORDENADOR DP', pedido.id, 'confirmar', 403);
      await decidir('COORDENADOR DP', pedido.id, 'recusar', 403, { motivo: 'Não pode' });
      const aprovado = await decidir('RH', pedido.id, 'aprovar');
      assert.equal(aprovado.status, 'AGUARDANDO_ASSISTENTE'); assert.equal(aprovado.aprovadoRhNome, 'RH');
      assert.equal((await avisos('RH')).find(n => n.referenciaId === pedido.id && n.tipo === 'FOLGA_AGUARDA_RH')?.requerAcao, false);
      assert.equal((await avisos('ASSISTENTE')).find(n => n.referenciaId === pedido.id)?.requerAcao, true);
      await decidir('RH', pedido.id, 'recusar', 403, { motivo: 'Já passou' });
      const final = await decidir('ASSISTENTE', pedido.id, 'confirmar'); assert.equal(final.status, 'APROVADA');
      assert.equal(final.aprovadoDpNome, 'ASSISTENTE');
      const [row] = await sql`SELECT confirmado, aprovado_rh_por FROM ferias_solicitacoes WHERE id = ${pedido.id}`;
      assert.equal(row.confirmado, true); assert.equal(row.aprovado_rh_por, users.RH);
      await decidir('ASSISTENTE', pedido.id, 'confirmar', 404);
    });
    await t.test('recusa com motivo em cada etapa; motivo vazio é bloqueado', async () => {
      for (const papel of ['GESTOR', 'RH', 'ASSISTENTE']) {
        const pedido = await criar();
        if (papel !== 'GESTOR') await decidir('GESTOR', pedido.id, 'aprovar');
        if (papel === 'ASSISTENTE') await decidir('RH', pedido.id, 'aprovar');
        await decidir(papel, pedido.id, 'recusar', 400, { motivo: '   ' });
        const recusado = await decidir(papel, pedido.id, 'recusar', 200, { motivo: 'Indisponível' });
        assert.equal(recusado.status, 'REJEITADA');
        await decidir('ASSISTENTE', pedido.id, 'confirmar', 404);
      }
    });
    await t.test('sem setor/sem gerente e pedido do gerente entram no RH; Coord. DP também passa pelo RH', async () => {
      assert.equal((await criar('GESTOR')).status, 'AGUARDANDO_RH');
      const coord = await criar('COORDENADOR DP'); assert.equal(coord.status, 'AGUARDANDO_RH');
      await decidir('RH', coord.id, 'aprovar'); await decidir('ASSISTENTE', coord.id, 'confirmar');
      await sql`UPDATE setor SET gestor_id = NULL WHERE id = ${setor.id}`;
      const semGerente = await criar(); assert.equal(semGerente.status, 'AGUARDANDO_RH');
      await decidir('ASSISTENTE', semGerente.id, 'confirmar', 404);
      await sql`UPDATE setor SET gestor_id = ${users.GESTOR} WHERE id = ${setor.id}`;
    });
    await t.test('RH e Assistente não decidem o próprio pedido', async () => {
      const rh = await criar('RH'); await decidir('RH', rh.id, 'aprovar', 403);
      await decidir('RH', rh.id, 'recusar', 403, { motivo: 'Próprio' });
      const assistente = await criar('ASSISTENTE'); await decidir('RH', assistente.id, 'aprovar');
      await decidir('ASSISTENTE', assistente.id, 'confirmar', 403);
      await decidir('ASSISTENTE', assistente.id, 'recusar', 403, { motivo: 'Próprio' });
    });
    await t.test('férias solicitadas pelo RH seguem chefia → Assistente, sem autoaprovação nem aprovação RH fictícia', async () => {
      await sql`UPDATE users SET setor_id = ${setor.id} WHERE id = ${users.RH}`;
      const inicio = new Date(); inicio.setDate(inicio.getDate() + 80);
      while (inicio.getDay() !== 1) inicio.setDate(inicio.getDate() + 1);
      const fim = new Date(inicio); fim.setDate(fim.getDate() + 29);
      const criado = await call('RH', 'POST', '/ferias', { tipo: 'FERIAS', dataInicio: inicio.toISOString().slice(0, 10), dataFim: fim.toISOString().slice(0, 10), observacoes: null });
      assert.equal(criado.statusCode, 200, criado.body);
      const pedido = criado.json().data;
      assert.equal(pedido.status, 'PENDENTE'); assert.equal(pedido.etapaRhDispensada, true);
      await decidir('ASSISTENTE', pedido.id, 'confirmar', 404);
      await decidir('RH', pedido.id, 'aprovar', 403);
      assert.equal((await decidir('GESTOR', pedido.id, 'aprovar')).status, 'AGUARDANDO_ASSISTENTE');
      const [linha] = await sql`SELECT status, aprovado_gestor_por, aprovado_rh_por, aprovado_rh_em, confirmado FROM ferias_solicitacoes WHERE id = ${pedido.id}`;
      assert.equal(linha.status, 'APROVADO_RH'); assert.equal(linha.aprovado_gestor_por, users.GESTOR);
      assert.equal(linha.aprovado_rh_por, null); assert.equal(linha.aprovado_rh_em, null); assert.equal(linha.confirmado, false);
      const [notificacoesRh] = await sql`SELECT COUNT(*)::int AS total FROM notificacoes WHERE referencia_id = ${pedido.id} AND tipo = 'FERIAS_AGUARDA_RH'`;
      assert.equal(notificacoesRh.total, 0);
      assert.equal((await avisos('ASSISTENTE')).find(n => n.referenciaId === pedido.id && n.tipo === 'FERIAS_AGUARDA_ASSISTENTE')?.requerAcao, true);
      await decidir('RH', pedido.id, 'recusar', 403, { motivo: 'Próprio' });
      assert.equal((await decidir('ASSISTENTE', pedido.id, 'confirmar')).status, 'APROVADA');
      const lista = await call('RH', 'GET', '/ferias');
      assert.equal(lista.json().data.find((s: { id: string }) => s.id === pedido.id)?.etapaRhDispensada, true);
      await sql`UPDATE users SET setor_id = NULL WHERE id = ${users.RH}`;
    });
    await t.test('RH sem chefia segue diretamente ao Assistente, que pode confirmar ou recusar', async () => {
      const confirmado = await criar('RH'); assert.equal(confirmado.status, 'AGUARDANDO_ASSISTENTE');
      assert.equal((await avisos('ASSISTENTE')).find(n => n.referenciaId === confirmado.id)?.requerAcao, true);
      await decidir('ASSISTENTE', confirmado.id, 'confirmar');
      const recusado = await criar('RH'); assert.equal(recusado.status, 'AGUARDANDO_ASSISTENTE');
      assert.equal((await decidir('ASSISTENTE', recusado.id, 'recusar', 200, { motivo: 'Reprogramar férias' })).status, 'REJEITADA');
      await decidir('ASSISTENTE', recusado.id, 'confirmar', 404);
    });
    await t.test('aceite de ajuste antigo do RH aplica a nova exceção, preservando a chefia quando houver', async () => {
      for (const temChefia of [false, true]) {
        await sql`UPDATE users SET setor_id = ${temChefia ? setor.id : null} WHERE id = ${users.RH}`;
        const [pedido] = await sql<{ id: string }[]>`
          INSERT INTO ferias_solicitacoes (user_id, tipo, data_inicio, data_fim, dias, status,
            data_inicio_sugerida, data_fim_sugerida, motivo_ajuste)
          VALUES (${users.RH}, 'FOLGA', '2030-01-07', '2030-01-07', 1, 'AJUSTE_SUGERIDO',
            '2030-01-08', '2030-01-08', 'Ajuste do fluxo anterior') RETURNING id
        `;
        const aceito = await decidir('RH', pedido.id, 'aceitar-ajuste');
        assert.equal(aceito.status, temChefia ? 'PENDENTE' : 'AGUARDANDO_ASSISTENTE');
        if (temChefia) assert.equal((await decidir('GESTOR', pedido.id, 'aprovar')).status, 'AGUARDANDO_ASSISTENTE');
        await decidir('ASSISTENTE', pedido.id, 'confirmar');
      }
      await sql`UPDATE users SET setor_id = NULL WHERE id = ${users.RH}`;
    });
    await t.test('ajuste do RH reinicia aprovações; Assistente e Coord. DP não sugerem ajuste', async () => {
      const pedido = await criar(); await decidir('GESTOR', pedido.id, 'aprovar');
      const payload = { dataInicioSugerida: '2030-01-08', motivo: 'Ajustar agenda' };
      await decidir('COORDENADOR DP', pedido.id, 'sugerir-ajuste', 403, payload);
      await decidir('ASSISTENTE', pedido.id, 'sugerir-ajuste', 403, payload);
      await decidir('RH', pedido.id, 'sugerir-ajuste', 200, payload);
      const novo = await decidir('COLABORADOR', pedido.id, 'aceitar-ajuste'); assert.equal(novo.status, 'PENDENTE');
      const [row] = await sql`SELECT aprovado_gestor_por, aprovado_rh_por, confirmado FROM ferias_solicitacoes WHERE id = ${pedido.id}`;
      assert.equal(row.aprovado_gestor_por, null); assert.equal(row.aprovado_rh_por, null); assert.equal(row.confirmado, false);
    });
    await t.test('dono cancela enquanto aguarda Assistente; Coord. DP enxerga pedidos e banco bloqueia escrita', async () => {
      const pedido = await criar(); await decidir('GESTOR', pedido.id, 'aprovar'); await decidir('RH', pedido.id, 'aprovar');
      assert.equal((await decidir('COLABORADOR', pedido.id, 'cancelar', 200, {})).status, 'CANCELADA');
      const list = await call('COORDENADOR DP', 'GET', '/ferias'); assert.equal(list.statusCode, 200, list.body);
      assert.ok(list.json().data.length > 0);
      await rodaComoUsuario({ id: users['COORDENADOR DP'], papelCodigo: 'COORDENADOR DP' }, async () => {
        const updated = await getDatabase()`UPDATE ferias_solicitacoes SET status = 'RECUSADO', motivo_recusa = 'Não autorizado' WHERE id = ${pedido.id}`;
        assert.equal(updated.count, 0);
      });
    });
    await t.test('férias aguardando Assistente bloqueiam duplicidade e consomem saldo só após confirmar', async () => {
      const inicio = new Date(); inicio.setDate(inicio.getDate() + 80);
      while (inicio.getDay() !== 1) inicio.setDate(inicio.getDate() + 1);
      const fim = new Date(inicio); fim.setDate(fim.getDate() + 29);
      const payload = { tipo: 'FERIAS', dataInicio: inicio.toISOString().slice(0, 10), dataFim: fim.toISOString().slice(0, 10), observacoes: null };
      const criado = await call('COLABORADOR', 'POST', '/ferias', payload);
      assert.equal(criado.statusCode, 200, criado.body);
      const id = criado.json().data.id as string;
      await decidir('GESTOR', id, 'aprovar'); await decidir('RH', id, 'aprovar');
      const duplicado = await call('COLABORADOR', 'POST', '/ferias', payload);
      assert.equal(duplicado.statusCode, 409, duplicado.body);
      const antes = await call('COLABORADOR', 'GET', '/ferias/resumo');
      assert.equal(antes.statusCode, 200, antes.body); assert.equal(antes.json().data.diasAgendados, 0);
      await decidir('ASSISTENTE', id, 'confirmar');
      const depois = await call('COLABORADOR', 'GET', '/ferias/resumo');
      assert.equal(depois.json().data.diasAgendados, 30);
      assert.equal(depois.json().data.diasDisponiveis, 0);
    });
    await t.test('gestor sem vínculo com o setor não aprova nem recusa', async () => {
      const pedido = await criar();
      await sql`UPDATE setor SET gestor_id = NULL WHERE id = ${setor.id}`;
      await decidir('GESTOR', pedido.id, 'aprovar', 403);
      await decidir('GESTOR', pedido.id, 'recusar', 403, { motivo: 'Fora da equipe' });
      await sql`UPDATE setor SET gestor_id = ${users.GESTOR} WHERE id = ${setor.id}`;
    });
    await t.test('Coord. DP acompanha todo o histórico, inclusive canceladas, mas não decide fora do DP', async () => {
      const lista = await call('COORDENADOR DP', 'GET', '/ferias');
      assert.equal(lista.statusCode, 200, lista.body);
      assert.ok(lista.json().data.some((s: { id: string }) => s.id === historico.id));
      assert.ok(lista.json().data.some((s: { status: string }) => s.status === 'CANCELADA'));
      await sql`UPDATE setor SET manager_id = ${users['COORDENADOR DP']} WHERE id = ${setor.id}`;
      const outroPapel = await criar();
      await decidir('COORDENADOR DP', outroPapel.id, 'aprovar', 403);
      await decidir('COORDENADOR DP', outroPapel.id, 'recusar', 403, { motivo: 'Não é DP' });
      const semSetor = await criar('DP'); assert.equal(semSetor.status, 'AGUARDANDO_RH');
      await decidir('COORDENADOR DP', semSetor.id, 'aprovar', 403);
      await sql`UPDATE setor SET manager_id = NULL WHERE id = ${setor.id}`;
    });
    await t.test('coordenadora do setor tem prioridade para DP e só decide a 1ª etapa', async () => {
      await sql`UPDATE setor SET manager_id = ${users['COORDENADOR DP']} WHERE id = ${setor.id}`;
      await sql`UPDATE users SET setor_id = ${setor.id} WHERE id = ${users.DP}`;
      const pedido = await criar('DP'); assert.equal(pedido.status, 'PENDENTE');
      const lista = await call('COORDENADOR DP', 'GET', '/ferias');
      const item = lista.json().data.find((s: { id: string }) => s.id === pedido.id);
      assert.equal(item.responsavelPrimeiraEtapaId, users['COORDENADOR DP']);
      assert.equal((await avisos('COORDENADOR DP')).find(n => n.referenciaId === pedido.id)?.requerAcao, true);
      await decidir('GESTOR', pedido.id, 'aprovar', 403);
      await decidir('GESTOR', pedido.id, 'recusar', 403, { motivo: 'Não é responsável' });
      assert.equal((await decidir('COORDENADOR DP', pedido.id, 'aprovar')).status, 'AGUARDANDO_RH');
      await decidir('COORDENADOR DP', pedido.id, 'aprovar', 403);
      await decidir('COORDENADOR DP', pedido.id, 'recusar', 403, { motivo: 'Etapa do RH' });
      await decidir('COORDENADOR DP', pedido.id, 'sugerir-ajuste', 403, { dataInicioSugerida: '2030-01-08', motivo: 'Ajuste' });
      await decidir('RH', pedido.id, 'sugerir-ajuste', 200, { dataInicioSugerida: '2030-01-08', motivo: 'Ajuste' });
      assert.equal((await decidir('DP', pedido.id, 'aceitar-ajuste')).status, 'PENDENTE');
      await decidir('COORDENADOR DP', pedido.id, 'aprovar');
      await decidir('RH', pedido.id, 'aprovar');
      await decidir('COORDENADOR DP', pedido.id, 'confirmar', 403);
      await decidir('COORDENADOR DP', pedido.id, 'recusar', 403, { motivo: 'Etapa do Assistente' });
      await decidir('ASSISTENTE', pedido.id, 'confirmar');
      await decidir('COORDENADOR DP', pedido.id, 'cancelar', 403, {});
      const recusa = await criar('DP');
      assert.equal((await decidir('COORDENADOR DP', recusa.id, 'recusar', 200, { motivo: 'Ausência simultânea' })).status, 'REJEITADA');
      await sql`UPDATE users SET setor_id = NULL WHERE id = ${users.DP}`;
      await sql`UPDATE setor SET manager_id = NULL WHERE id = ${setor.id}`;
    });
    await t.test('RLS bloqueia outra coordenadora e tentativa de pular etapas', async () => {
      const [outra] = await sql<{ id: string }[]>`
        INSERT INTO users (nome, email, role_id)
        VALUES ('Outra coordenadora', 'outra@example.test', (SELECT id FROM roles WHERE codigo = 'COORDENADOR DP')) RETURNING id
      `;
      await sql`UPDATE setor SET manager_id = ${outra.id} WHERE id = ${setor.id}`;
      await sql`UPDATE users SET setor_id = ${setor.id} WHERE id = ${users.DP}`;
      const pedido = await criar('DP');
      await decidir('COORDENADOR DP', pedido.id, 'aprovar', 403);
      await decidir('COORDENADOR DP', pedido.id, 'recusar', 403, { motivo: 'Outro setor' });
      await rodaComoUsuario({ id: users['COORDENADOR DP'], papelCodigo: 'COORDENADOR DP' }, async () => {
        const updated = await getDatabase()`UPDATE ferias_solicitacoes SET status = 'APROVADO_GESTOR', aprovado_gestor_por = ${users['COORDENADOR DP']}, aprovado_gestor_em = NOW() WHERE id = ${pedido.id}`;
        assert.equal(updated.count, 0);
      });
      await sql`UPDATE setor SET manager_id = ${users['COORDENADOR DP']} WHERE id = ${setor.id}`;
      await assert.rejects(rodaComoUsuario({ id: users['COORDENADOR DP'], papelCodigo: 'COORDENADOR DP' }, async () => {
        await getDatabase()`UPDATE ferias_solicitacoes SET status = 'APROVADO_RH', aprovado_rh_por = ${users['COORDENADOR DP']}, aprovado_rh_em = NOW() WHERE id = ${pedido.id}`;
      }), (error: unknown) => (error as { code?: string }).code === '42501');
      await sql`UPDATE users SET setor_id = NULL WHERE id = ${users.DP}`;
      await sql`UPDATE setor SET manager_id = NULL WHERE id = ${setor.id}`;
    });
    await t.test('setor admite coordenador e gerente, apenas um deles ou nenhum; chefias inativas não decidem', async () => {
      const [isolado] = await sql<{ id: string }[]>`INSERT INTO setor (nome) VALUES ('Sem chefia') RETURNING id`;
      await sql`UPDATE users SET setor_id = ${isolado.id} WHERE id = ${users.DP}`;
      assert.equal((await criar('DP')).status, 'AGUARDANDO_RH');
      await sql`UPDATE setor SET manager_id = ${users['COORDENADOR DP']} WHERE id = ${isolado.id}`;
      const coord = await criar('DP'); assert.equal(coord.status, 'PENDENTE');
      assert.equal((await avisos('COORDENADOR DP')).find(n => n.referenciaId === coord.id)?.requerAcao, true);
      await sql`UPDATE setor SET manager_id = NULL, gestor_id = ${users.GESTOR} WHERE id = ${isolado.id}`;
      assert.equal((await avisos('COORDENADOR DP')).find(n => n.referenciaId === coord.id)?.requerAcao, false);
      await decidir('COORDENADOR DP', coord.id, 'aprovar', 403);
      await decidir('GESTOR', coord.id, 'aprovar');
      await sql`UPDATE setor SET manager_id = ${users['COORDENADOR DP']}, gestor_id = NULL WHERE id = ${isolado.id}`;
      await sql`UPDATE users SET is_active = FALSE WHERE id = ${users['COORDENADOR DP']}`;
      assert.equal((await criar('DP')).status, 'AGUARDANDO_RH');
      await sql`UPDATE users SET is_active = TRUE WHERE id = ${users['COORDENADOR DP']}`;
      await sql`UPDATE users SET setor_id = NULL WHERE id = ${users.DP}`;
    });
    await t.test('cadastro de setores preserva papel do coordenador e permite remover ambas as chefias', async () => {
      const criado = await call('ADMIN', 'POST', '/tabelas/setores', { nome: 'Novo setor', managerId: users['COORDENADOR DP'], gestorId: users.GESTOR });
      assert.equal(criado.statusCode, 201, criado.body);
      const id = criado.json().data.id as string;
      assert.equal(criado.json().data.managerId, users['COORDENADOR DP']);
      const [coord] = await sql`SELECT r.codigo FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=${users['COORDENADOR DP']}`;
      assert.equal(coord.codigo, 'COORDENADOR DP');
      const soNome = await call('ADMIN', 'PATCH', `/tabelas/setores/${id}`, { nome: 'Renomeado' });
      assert.equal(soNome.statusCode, 200, soNome.body);
      assert.equal(soNome.json().data.managerId, users['COORDENADOR DP']);
      const removido = await call('ADMIN', 'PATCH', `/tabelas/setores/${id}`, { nome: 'Sem chefias', managerId: null, gestorId: null });
      assert.equal(removido.statusCode, 200, removido.body);
      assert.equal(removido.json().data.managerId, null); assert.equal(removido.json().data.gestorId, null);
      const invalido = await call('ADMIN', 'POST', '/tabelas/setores', { nome: 'Mesmo usuário', managerId: users['COORDENADOR DP'], gestorId: users['COORDENADOR DP'] });
      assert.equal(invalido.statusCode, 400, invalido.body);
      const [coluna] = await sql`SELECT COUNT(*)::int AS total FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='manager_id'`;
      assert.equal(coluna.total, 0);
    });
    await t.test('decisões simultâneas no RH avançam uma única vez e não pulam a confirmação', async () => {
      const pedido = await criar(); await decidir('GESTOR', pedido.id, 'aprovar');
      const results = await Promise.all([call('RH', 'PATCH', `/ferias/${pedido.id}/aprovar`), call('RH', 'PATCH', `/ferias/${pedido.id}/recusar`, { motivo: 'Conflito' })]);
      assert.equal(results.filter(r => r.statusCode === 200).length, 1);
      const [row] = await sql`SELECT status, confirmado FROM ferias_solicitacoes WHERE id = ${pedido.id}`;
      assert.ok(['APROVADO_RH', 'RECUSADO'].includes(row.status)); assert.equal(row.confirmado, false);
    });
  });
} finally {
  await app.close();
  await getDatabase().end();
  await sql.end();
}
