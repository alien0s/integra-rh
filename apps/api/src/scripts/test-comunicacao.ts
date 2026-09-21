// Script de teste manual do módulo de Comunicação.
// Roda a lógica direto (sem precisar de token/HTTP) pra validar as regras.
//
// Como rodar (de dentro de apps/api):
//   npx tsx src/scripts/test-comunicacao.ts

import { getDatabase } from "../lib/database.js";
import {
  aprovarComunicado,
  criarComunicado,
  listarComunicadosAtivos,
  rejeitarComunicado,
} from "../lib/comunicacao.js";

const sql = getDatabase();

async function buscarUsuarioPorPapel(papelCodigo: string) {
  const [row] = await sql`
    SELECT u.id, u.email, r.codigo AS "papelCodigo"
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.codigo = ${papelCodigo}
    LIMIT 1
  `;
  return row as { id: string; email: string; papelCodigo: string } | undefined;
}

async function main() {
  console.log("Buscando usuários de teste...");
  const rh = await buscarUsuarioPorPapel("RH");
  const coordenador =
    (await buscarUsuarioPorPapel("COORDENADOR")) ??
    (await buscarUsuarioPorPapel("GESTOR"));

  if (!rh) {
    throw new Error("Nenhum usuário com papel RH encontrado no banco.");
  }
  if (!coordenador) {
    throw new Error("Nenhum usuário com papel COORDENADOR ou GESTOR encontrado no banco.");
  }

  console.log(`RH: ${rh.email}`);
  console.log(`Coordenador/Gestor: ${coordenador.email}`);

  console.log("\n1) Coordenador cria um comunicado...");
  const c1 = await criarComunicado(
    {
      titulo: "Teste — comunicado do coordenador",
      descricao: "Criado pelo script de teste",
      dataInicio: "2026-09-15",
      dataFim: "2026-09-22",
    },
    coordenador.id,
    coordenador.papelCodigo,
  );
  console.log(`   status: ${c1.status} (esperado: AGUARDANDO_APROVACAO)`);

  console.log("\n2) RH aprova esse comunicado...");
  const c2 = await aprovarComunicado(c1.id, rh.id, rh.papelCodigo);
  console.log(`   status: ${c2.status} (esperado: PUBLICADO)`);

  console.log("\n3) RH cria um comunicado direto...");
  const c3 = await criarComunicado(
    {
      titulo: "Teste — comunicado direto do RH",
      descricao: "Criado pelo script de teste",
      dataInicio: "2026-09-15",
      dataFim: "2026-09-22",
    },
    rh.id,
    rh.papelCodigo,
  );
  console.log(`   status: ${c3.status} (esperado: PUBLICADO, sem aprovação)`);

  console.log("\n4) Coordenador cria outro comunicado e o RH rejeita...");
  const c4 = await criarComunicado(
    {
      titulo: "Teste — comunicado que vai ser rejeitado",
      descricao: "Criado pelo script de teste",
      dataInicio: "2026-09-15",
      dataFim: "2026-09-22",
    },
    coordenador.id,
    coordenador.papelCodigo,
  );
  const c4Rejeitado = await rejeitarComunicado(
    c4.id,
    "Motivo de teste",
    rh.id,
    rh.papelCodigo,
  );
  console.log(`   status: ${c4Rejeitado.status} (esperado: REJEITADO)`);

  console.log("\n5) Tentando criar comunicado como COLABORADOR (deve dar erro)...");
  try {
    await criarComunicado(
      {
        titulo: "Não deveria existir",
        descricao: "x",
        dataInicio: "2026-09-15",
        dataFim: "2026-09-22",
      },
      coordenador.id,
      "COLABORADOR",
    );
    console.log("   ERRO: deveria ter bloqueado, mas não bloqueou!");
  } catch (err) {
    console.log(`   Bloqueado corretamente: "${(err as Error).message}"`);
  }

  console.log("\n6) Listando comunicados ativos (mural)...");
  const ativos = await listarComunicadosAtivos();
  console.log(`   Total ativos: ${ativos.length}`);
  ativos.forEach((c) => console.log(`   - [${c.id}] ${c.titulo}`));

  console.log("\nTeste concluído.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro no teste:", err);
  process.exit(1);
});