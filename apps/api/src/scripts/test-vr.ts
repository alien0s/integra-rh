import { writeFileSync } from "node:fs";

import { getDatabase } from "../lib/database.js";
import { fecharVrPorEntidade } from "../lib/vr.service.js";
import {
  buscarRegistrosParaExportacao,
  gerarRelatorioVrCsv,
  gerarRelatorioVrExcel,
  gerarRelatorioVrPdf,
} from "../lib/vr.export.js";

/**
 * Testa o fluxo completo do módulo de VR (fechamento por entidade + geração
 * dos 3 arquivos) num mês de teste isolado, sem afetar dados reais.
 *
 * Uso:
 *   pnpm --filter @erp/api test:vr
 *     → cria o mês de teste (mês 1 / ano 2099, não colide com mês real),
 *       fecha a entidade de um colaborador real (só leitura), gera os
 *       arquivos em /tmp e apaga os dados de teste no final.
 *
 *   pnpm --filter @erp/api test:vr -- --manter
 *     → mesma coisa, mas NÃO apaga os dados de teste no final.
 */

const MES_TESTE = 1;
const ANO_TESTE = 2099;
const VALOR_DIARIO_TESTE = 35;
const VALOR_DIARIO_APRENDIZ_TESTE = 20;
const DIAS_ELEGIVEIS_TESTE = 17;

async function main() {
  const manter = process.argv.includes("--manter");
  const sql = getDatabase();

  console.log(`→ Preparando mês de teste ${MES_TESTE}/${ANO_TESTE}...`);

  await limparDadosDeTeste(sql);

  const [usuarioTeste] = await sql<{ id: string; nome: string; entityId: string; entityNome: string; grupo: string }[]>`
    SELECT u.id, u.nome, u.entity_id AS "entityId", e.nome AS "entityNome", e.grupo
    FROM users u
    JOIN entities e ON e.id = u.entity_id
    WHERE u.is_active = TRUE AND u.participa_vr = TRUE
      AND e.participa_vr = TRUE AND e.grupo IS NOT NULL
    ORDER BY u.nome
    LIMIT 1
  `;
  if (!usuarioTeste) {
    console.error(
      "✗ Nenhum usuário ativo com entidade vinculada encontrado — não dá pra testar sem isso.",
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    `✓ Usando usuário real (só leitura): ${usuarioTeste.nome} — entidade: ${usuarioTeste.entityNome} (grupo ${usuarioTeste.grupo})`,
  );

  // O mês de teste é do MESMO grupo do usuário de teste (cada grupo tem o seu mês).
  const [vrMes] = await sql<{ id: string }[]>`
    INSERT INTO vr_mes (grupo, mes, ano, valor_diario, valor_diario_aprendiz)
    VALUES (${usuarioTeste.grupo}, ${MES_TESTE}, ${ANO_TESTE}, ${VALOR_DIARIO_TESTE}, ${VALOR_DIARIO_APRENDIZ_TESTE})
    RETURNING id
  `;
  console.log(`✓ vr_mes de teste criado: ${vrMes.id}`);

  for (let dia = 1; dia <= DIAS_ELEGIVEIS_TESTE; dia++) {
    await sql`
      INSERT INTO vr_dia_elegivel (data, vr_mes_id)
      VALUES (${`${ANO_TESTE}-01-${String(dia).padStart(2, "0")}`}, ${vrMes.id})
    `;
  }
  console.log(`✓ ${DIAS_ELEGIVEIS_TESTE} dias elegíveis cadastrados`);

  // Lançamento de teste: 4 dias de desconto (dentro da capacidade, não deve virar excedente)
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
  console.log("✓ 4 lançamentos de desconto de teste criados\n");

  console.log(`→ Fechando o VR da entidade "${usuarioTeste.entityNome}" (teste)...`);
  const resultado = await fecharVrPorEntidade(vrMes.id, usuarioTeste.entityId);
  console.log("✓ Fechamento concluído:", resultado, "\n");

  console.log("→ Gerando os 3 arquivos de exportação (só dessa entidade)...");
  const registros = await buscarRegistrosParaExportacao(vrMes.id, usuarioTeste.entityId);
  console.log(`  (${registros.length} registro(s) encontrado(s) para exportar)`);

  const pdf = await gerarRelatorioVrPdf(registros, "Script de teste (test:vr)");
  const csv = gerarRelatorioVrCsv(registros);
  const excel = gerarRelatorioVrExcel(registros);

  writeFileSync("/tmp/vr-teste-relatorio.pdf", pdf);
  writeFileSync("/tmp/vr-teste-arquivo.csv", csv, "utf8");
  writeFileSync("/tmp/vr-teste-planilha.xlsx", excel);

  console.log("✓ Arquivos salvos em:");
  console.log("  /tmp/vr-teste-relatorio.pdf");
  console.log("  /tmp/vr-teste-arquivo.csv");
  console.log("  /tmp/vr-teste-planilha.xlsx");
  console.log("\nConteúdo do CSV gerado:");
  console.log(csv || "(vazio — provavelmente o usuário de teste não tem codigo_aps preenchido)");

  if (manter) {
    console.log("\n⚠ --manter passado: dados de teste NÃO foram apagados.");
  } else {
    console.log("\n→ Limpando dados de teste...");
    await limparDadosDeTeste(sql);
    console.log("✓ Dados de teste removidos (usuário real não foi alterado).");
  }
}

/**
 * Remove tudo que esse script cria, em qualquer execução (idempotente).
 * Apagar o vr_mes já em cascata apaga vr_dia_elegivel e
 * vr_fechamento_entidade (ON DELETE CASCADE) — só precisa apagar
 * vr_lancamento e vr_registro manualmente antes, por causa da FK.
 */
async function limparDadosDeTeste(sql: ReturnType<typeof getDatabase>) {
  const [vrMesExistente] = await sql<{ id: string }[]>`
    SELECT id FROM vr_mes WHERE mes = ${MES_TESTE} AND ano = ${ANO_TESTE} LIMIT 1 /* só o do teste */
  `;
  if (!vrMesExistente) return;

  await sql`DELETE FROM vr_lancamento WHERE mes_descontar_valor_id = ${vrMesExistente.id}`;
  await sql`DELETE FROM vr_registro WHERE vr_mes_id = ${vrMesExistente.id}`;
  await sql`DELETE FROM vr_mes WHERE id = ${vrMesExistente.id}`;
}

main()
  .catch((error) => {
    console.error("\n✗ Falha no teste:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => process.exit());
  