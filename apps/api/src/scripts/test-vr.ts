import { writeFileSync } from "node:fs";

import { getDatabase, rodaComoUsuario } from "../lib/database.js";
import {
  buscarRegistrosParaExportacao,
  gerarRelatorioVrCsv,
  gerarRelatorioVrExcel,
  gerarRelatorioVrPdf,
} from "../lib/vr.export.js";
import { fecharVrPorEntidade } from "../lib/vr.service.js";

/**
 * Testa o fluxo completo do módulo de VR (fechamento por entidade + geração
 * dos 3 arquivos) num mês de teste isolado, sem afetar dados reais.
 *
 * As tabelas do VR têm RLS FORÇADO — por isso o script age como ADMIN:
 *  - criar/limpar/exportar rodam dentro de `rodaComoUsuario`;
 *  - `fecharVrPorEntidade` abre a PRÓPRIA transação (e seta a identidade nela),
 *    então é chamada FORA de qualquer `rodaComoUsuario`.
 *
 * Uso:
 *   pnpm --filter @erp/api test:vr
 *     → cria o mês de teste (mês 1 / ano 2099, não colide com mês real) no
 *       grupo de um colaborador real (só leitura), fecha a entidade dele, gera
 *       os arquivos em /tmp e apaga os dados de teste no final.
 *
 *   pnpm --filter @erp/api test:vr -- --manter
 *     → mesma coisa, mas NÃO apaga os dados de teste no final.
 */

const MES_TESTE = 1;
const ANO_TESTE = 2099;
const VALOR_DIARIO_TESTE = 35;
const VALOR_DIARIO_APRENDIZ_TESTE = 20;
const DIAS_ELEGIVEIS_TESTE = 17;

/** Identidade do script (papel ADMIN passa em todas as policies do VR). */
const USUARIO_SCRIPT = { id: "test-vr-script", papelCodigo: "ADMIN" };

interface UsuarioTeste {
  id: string;
  nome: string;
  entityId: string;
  entityNome: string;
  grupo: string;
}

async function main() {
  const manter = process.argv.includes("--manter");

  console.log(`→ Preparando mês de teste ${MES_TESTE}/${ANO_TESTE}...`);

  // 1) Limpa resíduo de execução anterior e escolhe um colaborador real (só leitura).
  const usuarioTeste = await rodaComoUsuario(USUARIO_SCRIPT, async () => {
    const sql = getDatabase();
    await limparDadosDeTeste(sql);
    const [u] = await sql<UsuarioTeste[]>`
      SELECT u.id, u.nome, u.entity_id AS "entityId", e.nome AS "entityNome", e.grupo
      FROM users u
      JOIN entities e ON e.id = u.entity_id
      WHERE u.is_active = TRUE AND u.participa_vr = TRUE
        AND e.participa_vr = TRUE AND e.grupo IS NOT NULL
      ORDER BY u.nome
      LIMIT 1
    `;
    return u ?? null;
  });
  if (!usuarioTeste) {
    console.error(
      "✗ Nenhum usuário ativo com entidade (que participe do VR) encontrado — não dá pra testar sem isso.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `✓ Usando usuário real (só leitura): ${usuarioTeste.nome} — entidade: ${usuarioTeste.entityNome} (grupo ${usuarioTeste.grupo})`,
  );

  // 2) Cria o mês (do MESMO grupo do usuário), os dias elegíveis e 4 descontos de teste.
  const vrMesId = await rodaComoUsuario(USUARIO_SCRIPT, async () => {
    const sql = getDatabase();
    const [vrMes] = await sql<{ id: string }[]>`
      INSERT INTO vr_mes (grupo, mes, ano, valor_diario, valor_diario_aprendiz)
      VALUES (${usuarioTeste.grupo}, ${MES_TESTE}, ${ANO_TESTE}, ${VALOR_DIARIO_TESTE}, ${VALOR_DIARIO_APRENDIZ_TESTE})
      RETURNING id
    `;
    for (let dia = 1; dia <= DIAS_ELEGIVEIS_TESTE; dia++) {
      await sql`
        INSERT INTO vr_dia_elegivel (data, vr_mes_id)
        VALUES (${`${ANO_TESTE}-01-${String(dia).padStart(2, "0")}`}, ${vrMes.id})
      `;
    }
    // 4 dias de desconto (dentro da capacidade, não deve virar excedente)
    for (let i = 0; i < 4; i++) {
      await sql`
        INSERT INTO vr_lancamento (
          user_id, mes_descontar_valor_id, tipo_lancamento, data_desconto, motivo
        )
        VALUES (
          ${usuarioTeste.id}, ${vrMes.id}, 'DESCONTO',
          ${`${ANO_TESTE}-01-${String(i + 1).padStart(2, "0")}`}, 'Lançamento de teste (test:vr)'
        )
      `;
    }
    return vrMes.id;
  });
  console.log(`✓ vr_mes de teste criado: ${vrMesId} (${DIAS_ELEGIVEIS_TESTE} dias, 4 lançamentos)\n`);

  // 3) Fecha a entidade — FORA do rodaComoUsuario (a função abre o próprio begin).
  console.log(`→ Fechando o VR da entidade "${usuarioTeste.entityNome}" (teste)...`);
  const resultado = await fecharVrPorEntidade(vrMesId, usuarioTeste.entityId, USUARIO_SCRIPT);
  console.log("✓ Fechamento concluído:", resultado, "\n");

  // 4) Exporta (leitura com identidade) e gera os 3 arquivos.
  console.log("→ Gerando os 3 arquivos de exportação (só dessa entidade)...");
  const registros = await rodaComoUsuario(USUARIO_SCRIPT, () =>
    buscarRegistrosParaExportacao(vrMesId, usuarioTeste.entityId),
  );
  console.log(`  (${registros.length} registro(s) encontrado(s) para exportar)`);

  const pdf = await gerarRelatorioVrPdf(registros, "Script de teste (test:vr)");
  const csv = gerarRelatorioVrCsv(registros);
  const excel = gerarRelatorioVrExcel(registros);

  writeFileSync("/tmp/vr-teste-relatorio.pdf", pdf);
  writeFileSync("/tmp/vr-teste-arquivo.txt", csv, "utf8");
  writeFileSync("/tmp/vr-teste-planilha.xlsx", excel);

  console.log("✓ Arquivos salvos em:");
  console.log("  /tmp/vr-teste-relatorio.pdf");
  console.log("  /tmp/vr-teste-arquivo.txt");
  console.log("  /tmp/vr-teste-planilha.xlsx");
  console.log("\nConteúdo do CSV gerado:");
  console.log(csv || "(vazio — provavelmente o usuário de teste não tem codigo_aps preenchido)");

  if (manter) {
    console.log("\n⚠ --manter passado: dados de teste NÃO foram apagados.");
  } else {
    console.log("\n→ Limpando dados de teste...");
    await rodaComoUsuario(USUARIO_SCRIPT, async () => limparDadosDeTeste(getDatabase()));
    console.log("✓ Dados de teste removidos (usuário real não foi alterado).");
  }
}

/**
 * Remove tudo que esse script cria, em qualquer execução (idempotente) — em
 * todos os grupos (o mês 1/2099 só existe por causa do teste). Apagar o vr_mes
 * já apaga em cascata vr_dia_elegivel e vr_fechamento_entidade; vr_lancamento e
 * vr_registro precisam ser apagados antes, por causa da FK.
 * Precisa rodar DENTRO de `rodaComoUsuario` (RLS forçado).
 */
async function limparDadosDeTeste(sql: ReturnType<typeof getDatabase>) {
  const meses = await sql<{ id: string }[]>`
    SELECT id FROM vr_mes WHERE mes = ${MES_TESTE} AND ano = ${ANO_TESTE}
  `;
  for (const { id } of meses) {
    await sql`DELETE FROM vr_lancamento WHERE mes_descontar_valor_id = ${id}`;
    await sql`DELETE FROM vr_registro WHERE vr_mes_id = ${id}`;
    await sql`DELETE FROM vr_mes WHERE id = ${id}`;
  }
}

main()
  .catch((error) => {
    console.error("\n✗ Falha no teste:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
  