import { getDatabase } from "../lib/database.js";
import {
  aplicarTransicao,
  buscarUsuarioComAprovadores,
  listarHistorico,
  listarUsuarios,
  resumoDoUsuario,
  salvarCalendarioDoMes,
  filaDoLider,
  filaFinal,
} from "../lib/presencaCulto.js";
import {
  motivoNaoPodeAjustar,
  motivoNaoPodeDecidirFinal,
  motivoNaoPodeDecidirLider,
  motivoNaoPodeJustificarPropria,
  patchAjusteManual,
  patchDecisaoFinal,
  patchDecisaoLider,
  patchJustificar,
} from "../lib/presencaCulto.regras.js";
import { ACAO_HISTORICO } from "../types/presencaCulto.js";

const ANO = 2020;
const MES = 2;
const DIAS = ["2020-02-03", "2020-02-04", "2020-02-05", "2020-02-06"];
const INICIO = "2020-02-01";
const FIM = "2020-02-29";

let falhas = 0;
function confere(condicao: any, descricao: string, detalhe?: any) {
  if (condicao) {
    console.log(`  ✅ ${descricao}`);
  } else {
    falhas++;
    console.log(`  ❌ ${descricao}`, detalhe !== undefined ? detalhe : "");
  }
}

function titulo(texto: string) {
    console.log(`\n▶ ${texto}`);
}


async function main() {
  const sql: any = getDatabase();

  // ── 0. Escolhe um colaborador com etapa de líder ─────────────────────────
  titulo("Preparação");

  const usuarios = await listarUsuarios();
  let colaborador: any = null;
  let aprovadores: any = null;

  for (const u of usuarios) {
    if (u.papel !== "COLABORADOR") continue;
    const ctx = await buscarUsuarioComAprovadores(u.id);
    if (ctx && typeof ctx.aprovadores !== "string" && ctx.aprovadores.lider_id) {
      const [linha] = await sql`SELECT codigo_aps_entidade FROM users WHERE id = ${u.id}`;
      if (!linha?.codigo_aps_entidade) continue;
      colaborador = { ...u, codigo: linha.codigo_aps_entidade };
      aprovadores = ctx.aprovadores;
      break;
    }
  }

  if (!colaborador) {
    console.log(`
  ⚠️  Não achei nenhum COLABORADOR com líder resolvido.
     Confira:
       1. A Norma é o gestor_id do setor "Depto de Recursos Humanos"?
       2. Existe algum setor com gestor_id preenchido e colaboradores nele?
       3. Esses colaboradores têm codigo_aps_entidade?
`);
    return;
  }

  const liderId = aprovadores.lider_id;
  const finalId = aprovadores.final_aprovador_id;
  const nomeDe = (id: string) => usuarios.find((u: any) => u.id === id)?.nome ?? id;

  console.log(`  Colaborador: ${colaborador.nome} (${colaborador.setor_nome})`);
  console.log(`  Líder:       ${nomeDe(liderId)}`);
  console.log(`  Final:       ${nomeDe(finalId)}`);

  // Calendário com os 4 dias de teste
  await salvarCalendarioDoMes(ANO, MES, DIAS, liderId);

  // Carga simulada (como o Python/Automate faria)
  const carga = [
    { data: DIAS[0], hora: "07:28", status: "Presente", pontuacao: 3 },
    { data: DIAS[1], hora: null, status: "Falta", pontuacao: -1 },
    { data: DIAS[2], hora: "07:45", status: "Atraso", pontuacao: 0 },
    { data: DIAS[3], hora: null, status: "Falta", pontuacao: -1 },
  ];
  for (const c of carga) {
    await sql`
      INSERT INTO presenca_culto (codigo_aps_entidade, nome, data, hora, status, pontuacao)
      VALUES (${colaborador.codigo}, ${colaborador.nome}, ${c.data}, ${c.hora}, ${c.status}, ${c.pontuacao})
    `;
  }

  const registros = await sql`
    SELECT * FROM presenca_culto
     WHERE codigo_aps_entidade = ${colaborador.codigo} AND data BETWEEN ${INICIO} AND ${FIM}
     ORDER BY data
  `;
  const [presente, falta1, atraso, falta2] = registros;

  confere(registros.length === 4, "Carga inseriu 4 registros");
  confere(registros.every((r: any) => r.user_id === colaborador.id), "Trigger vinculou todos ao colaborador");
  confere(falta1.status_original === "Falta" && falta1.pontuacao_original === -1, "Trigger guardou o original da falta");

  // ── 1. Resumo inicial ────────────────────────────────────────────────────
  titulo("Resumo inicial (3 + -1 + 0 + -1 = 1 de 12)");
  let resumo = await resumoDoUsuario(colaborador.id, INICIO, FIM);
  confere(resumo.pontos === 1 && resumo.maximo === 12, "Pontos 1 / máximo 12", resumo);
  confere(resumo.aproveitamento === 8.33, "Aproveitamento 8,33%", resumo.aproveitamento);
  confere(resumo.faltas === 2 && resumo.atrasos === 1 && resumo.pontuais === 1, "2 faltas, 1 atraso, 1 pontual");

  // Funções de transição iguais às das rotas
  const justificar = (id: string, tipo: string, texto: string) =>
    aplicarTransicao(id, colaborador.id, (r) => {
      const motivo = motivoNaoPodeJustificarPropria(r, colaborador.id);
      if (motivo) return motivo;
      return {
        acao: ACAO_HISTORICO.JUSTIFICOU,
        patch: patchJustificar({ tipo, texto, autorId: colaborador.id, aprovadores, porLider: false }),
      };
    });

  const decidirLider = (id: string, acao: any, comentario?: string) =>
    aplicarTransicao(id, liderId, (r) => {
      const motivo = motivoNaoPodeDecidirLider(r, liderId, acao);
      if (motivo) return motivo;
      const acaoHistorico =
        acao === "APROVAR" ? ACAO_HISTORICO.LIDER_APROVOU
        : acao === "NEGAR" ? ACAO_HISTORICO.LIDER_NEGOU
        : ACAO_HISTORICO.LIDER_DEVOLVEU;
      return { acao: acaoHistorico, comentario, patch: patchDecisaoLider(r, acao, comentario) };
    });

  const decidirFinal = (id: string, acao: any, comentario?: string) =>
    aplicarTransicao(id, finalId, (r) => {
      const motivo = motivoNaoPodeDecidirFinal(r, finalId);
      if (motivo) return motivo;
      const acaoHistorico = acao === "APROVAR" ? ACAO_HISTORICO.FINAL_APROVOU : ACAO_HISTORICO.FINAL_NEGOU;
      return { acao: acaoHistorico, comentario, patch: patchDecisaoFinal(r, acao, comentario) };
    });

  // ── 2. Justificar, devolver, rejustificar, aprovar ───────────────────────
  titulo("Falta 1: justifica → líder devolve → rejustifica → líder aprova → final aprova");

  let res: any = await justificar(falta1.id, "Viagens a Trabalho", "Viagem para Parintins");
  confere(res.data?.atualizado.status === "Em Aprovação", "Justificou → Em Aprovação", res.erro);

  let fila = await filaDoLider(liderId);
  confere(fila.some((r: any) => r.id === falta1.id), "Aparece na fila do líder");

  res = await decidirFinal(falta1.id, "APROVAR");
  confere(!!res.erro, "Final NÃO pode aprovar antes do líder", res.erro);

  res = await decidirLider(falta1.id, "DEVOLVER", "Anexe o comprovante da viagem");
  confere(
    res.data?.atualizado.status === "Falta" && res.data?.atualizado.segunda_chance === true,
    "Líder devolveu → Falta com segunda chance usada",
    res.erro,
  );

  res = await justificar(falta1.id, "Viagens a Trabalho", "Viagem para Parintins (com comprovante)");
  confere(res.data?.atualizado.status === "Em Aprovação", "Rejustificou após devolução", res.erro);

  res = await decidirLider(falta1.id, "DEVOLVER", "De novo");
  confere(!!res.erro, "Líder NÃO pode devolver duas vezes", res.erro);

  res = await decidirLider(falta1.id, "APROVAR");
  confere(res.data?.atualizado.status_lider === "Aprovada", "Líder aprovou", res.erro);

  fila = await filaFinal(finalId);
  confere(fila.some((r: any) => r.id === falta1.id), "Aparece na fila do aprovador final");

  res = await decidirFinal(falta1.id, "APROVAR");
  const aprovado = res.data?.atualizado;
  confere(
    aprovado?.status === "Justificado" && aprovado?.pontuacao === 0 && aprovado?.descontar_no_ranking === true,
    "Final aprovou → Justificado, 0 pts, dia descontado (viagem)",
    res.erro ?? aprovado,
  );

  // ── 3. Justificar e ser negado ───────────────────────────────────────────
  titulo("Falta 2: justifica (Atestado) → líder nega → não pode justificar de novo");

  res = await justificar(falta2.id, "Atestado", "Consulta médica");
  confere(res.data?.atualizado.status === "Em Aprovação", "Justificou → Em Aprovação", res.erro);

  res = await decidirLider(falta2.id, "NEGAR", "Sem atestado anexado");
  confere(
    res.data?.atualizado.status === "Falta" && res.data?.atualizado.pontuacao === -1,
    "Líder negou → volta pra Falta, -1",
    res.erro,
  );

  res = await justificar(falta2.id, "Atestado", "Tentando de novo");
  confere(!!res.erro, "NÃO pode justificar falta já negada", res.erro);

  res = await justificar(atraso.id, "Outros", "Trânsito");
  confere(!!res.erro, "NÃO pode justificar atraso", res.erro);

  // ── 4. Resumo depois das justificativas ──────────────────────────────────
  titulo("Resumo (dia da viagem sai: 3 + 0 + -1 = 2 de 9)");
  resumo = await resumoDoUsuario(colaborador.id, INICIO, FIM);
  confere(resumo.dias_descontados === 1 && resumo.dias_elegiveis === 3, "1 dia descontado, 3 elegíveis", resumo);
  confere(resumo.pontos === 2 && resumo.maximo === 9, "Pontos 2 / máximo 9", resumo);
  confere(resumo.aproveitamento === 22.22, "Aproveitamento 22,22%", resumo.aproveitamento);

  // ── 5. Ajuste manual do RH ───────────────────────────────────────────────
  titulo("Ajuste manual: câmera não pegou, RH corrige o atraso pra 07:29");

  res = await aplicarTransicao(atraso.id, finalId, (r) => {
    const motivo = motivoNaoPodeAjustar(r);
    if (motivo) return motivo;
    const patch = patchAjusteManual(r, { hora: "07:29", comentario: "Câmera não reconheceu" });
    if (typeof patch === "string") return patch;
    return { acao: ACAO_HISTORICO.AJUSTE_MANUAL, comentario: "Câmera não reconheceu", patch };
  });
  const ajustado = res.data?.atualizado;
  confere(
    ajustado?.status === "Presente" && ajustado?.pontuacao === 3 && ajustado?.ajustado_manualmente === true,
    "Virou Presente, +3, marcado como ajustado",
    res.erro ?? ajustado,
  );
  confere(ajustado?.status_original === "Presente", "O ajuste virou o novo original");

  titulo("Resumo final (3 + 3 + -1 = 5 de 9)");
  resumo = await resumoDoUsuario(colaborador.id, INICIO, FIM);
  confere(resumo.pontos === 5 && resumo.aproveitamento === 55.56, "Pontos 5 / 55,56%", resumo);
  confere(resumo.pontuais === 2, "2 chegadas pontuais", resumo.pontuais);
  confere(resumo.categoria === "Participante", "Categoria Participante", resumo.categoria);

  // ── 6. Histórico ─────────────────────────────────────────────────────────
  titulo("Histórico");
  const historico = await listarHistorico(falta1.id);
  confere(historico.length === 5, "Falta 1 tem 5 eventos (justificou, devolveu, justificou, aprovou, aprovou)", historico.length);
}

async function limpar() {
    const sql: any = getDatabase();
    await sql`
    DELETE FROM presenca_culto
        WHERE data BETWEEN ${INICIO} AND ${FIM}
            AND nome IS NOT NULL
    `;
    await sql`DELETE FROM presenca_culto_calendario WHERE data BETWEEN ${INICIO} AND ${FIM}`;
}

main()
  .catch((e) => {
    falhas++;
    console.error("\n💥 Erro inesperado:", e);
  })
  .finally(async () => {
    try {
      await limpar();
      console.log("\n🧹 Dados de teste apagados.");
    } catch (e) {
      console.error("Falha ao limpar os dados de teste:", e);
    }
    console.log(falhas === 0 ? "\n🎉 Tudo certo!" : `\n⚠️  ${falhas} verificação(ões) falharam.`);
    const sql: any = getDatabase();
    await sql.end?.({ timeout: 5 });
    process.exit(falhas === 0 ? 0 : 1);
  });
