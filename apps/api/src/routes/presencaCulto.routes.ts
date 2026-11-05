import { randomUUID } from "node:crypto";
import { extname } from "node:path";

import type  { FastifyInstance } from "fastify";

import {
  aplicarTransicao,
  aplicarTransicaoEmLote,
  atualizarPeriodo,
  buscarRegistro,
  buscarUsuarioComAprovadores,
  contarPorUsuario,
  criarPeriodo,
  datasDoCalendario,
  definirSuperiorDoSetor,
  excluirPeriodo,
  filaDoLider,
  filaFinal,
  hojeISO,
  intervaloDoMes,
  listarCalendario,
  listarEquipeDoLider,
  listarHistorico,
  listarJustificativas,
  listarPeriodos,
  listarRegistrosDoUsuario,
  listarRegistrosPorData,
  listarRegistrosSemUsuario,
  listarSetoresComSuperior,
  listarUsuarios,
  periodoVigente,
  buscarPeriodo,
  rankingDoPeriodo,
  removerSuperiorDoSetor,
  resumoDoUsuario,
  salvarCalendarioDoMes,
} from "../lib/presencaCulto.js";
import {
  etapaDoRegistro,
  motivoNaoPodeAjustar,
  motivoNaoPodeDecidirFinal,
  motivoNaoPodeDecidirLider,
  motivoNaoPodeJustificarPor,
  motivoNaoPodeJustificarPropria,
  paraDataISO,
  patchAjusteManual,
  patchDecisaoFinal,
  patchDecisaoLider,
  patchJustificar,
  validarAnexo,
  validarComentarioObrigatorio,
  validarJustificativa,
} from "../lib/presencaCulto.regras.js";
import { rodaComoUsuario } from "../lib/database.js";
import { emitirParaUsuario } from "../lib/notificacoes.js";
import { getObjectStream, uploadObject } from "../lib/storage.js";
import {
    ACAO_HISTORICO,
    ANEXO_PASTA_MINIO,
    PAPEIS_GESTAO_MODULO,
    PAPEIS_VISAO_GERAL,
} from "../types/presencaCulto.js";

/**
 * Rotas do módulo Presença no Culto. Fluxo da justificativa:
 *   Colaborador (ou o líder por ele) justifica uma Falta → "Em Aprovação".
 *   Se houver etapa de líder: líder aprova, nega ou devolve (segunda chance, 1x).
 *   Aprovador final (gerente de RH, ou Tesoureiro quando é ela) aprova ou nega.
 *   Aprovada: "Justificado", 0 pts, e o dia sai do ranking conforme o tipo.
 *   Negada: volta pro status/pontuação original (Falta, -1).
 * Quem aprova é resolvido em presencaCulto.regras.ts (resolverAprovadores).
 */

const TABELA = "presenca_culto";

/* ── Helpers ───────────────────────────────────────────────────────────── */

// Libera só os papéis informados (roda depois do app.authenticate)
function somentePapeis(papeis: string[]) {
  return async (request: any, reply: any) => {
    if (!papeis.includes(request.user?.papelCodigo)) {
      return reply.code(403).send({ message: "Sem permissão para esta ação." });
    }
  };
}

const ehVisaoGeral = (papel:string) => (PAPEIS_VISAO_GERAL as string[]).includes(papel);
const ehGestaoModulo = (papel:string) => (PAPEIS_GESTAO_MODULO as string[]).includes(papel);

// ?ano=2026&mes=11 (padrão: mês atual em Manaus)
function mesDaQuery(query: any) {
  const [anoHoje, mesHoje] = hojeISO().split("-").map(Number);
  const ano = Number(query?.ano) || anoHoje;
  const mes = Number(query?.mes) || mesHoje;
  return { ano, mes, ...intervaloDoMes(ano, mes) };
}

// Mesma regra de avatar do resto do sistema (ver notificacoes.ts)
function avatarUrl(userId: string | null, valor: string | null) {
  if (!userId || !valor) return "";
  if (valor.startsWith("http") || valor.startsWith("data:")) return valor;
  return `/usuarios/${userId}/avatar`;
}

// Acrescenta a etapa calculada e normaliza a foto de quem faltou
function formatarJustificativa(r: any) {
  return {
    ...r,
    data: paraDataISO(r.data),
    etapa: etapaDoRegistro(r),
    usuario_foto: avatarUrl(r.user_id, r.usuario_foto),
  };
}

function formatarRegistro(r: any) {
    return { ...r, data: paraDataISO(r.data), etapa: etapaDoRegistro(r) };
}

// O anexo enviado tem que ter sido enviado por quem está justificando
function anexoDoUsuario(anexo: any, userId: string) {
  if (!anexo) return null;
  if (typeof anexo.path !== "string" || !anexo.path.startsWith(`${ANEXO_PASTA_MINIO}/${userId}/`)) {
    return "Anexo inválido. Envie o arquivo novamente.";
  }
  return null;
}

async function notificar(request: any, destinatarioId: string | null, evento: any) {
  if (!destinatarioId || destinatarioId === request.user.id) return;
  try {
    // requerAcao fica false: os botões do sininho hoje só sabem agir em férias/qualificações
    await emitirParaUsuario(destinatarioId, {
      atorId: request.user.id,
      referenciaTabela: TABELA,
      requerAcao: false,
      ...evento,
    });
  } catch (error) {
    request.log.warn({ error }, "Falha ao notificar (Presença no Culto)");
  }
}

// Quem pode abrir um registro (detalhe, histórico e anexo)
async function podeVerRegistro(r: any, user: any) {
  const id = user.id;
  if (r.user_id === id || r.lider_id === id || r.final_aprovador_id === id || r.justificado_por === id) {
    return true;
  }
  if (ehVisaoGeral(user.papelCodigo)) return true;
  if (!r.user_id) return false;
  const dono = await buscarUsuarioComAprovadores(r.user_id);
  return !!dono && typeof dono.aprovadores !== "string" && dono.aprovadores.lider_id === id;
}

const schemaAnexo = {
  type: ["object", "null"],
  required: ["path", "nome", "mime"],
  properties: {
    path: { type: "string" },
    nome: { type: "string" },
    mime: { type: "string" },
  },
};

export async function presencaCultoRoutes(app: FastifyInstance) {
  const tags = ["Presença no Culto"];

  /* ── Colaborador ─────────────────────────────────────────────────────── */

  // Meu mês: registros, resumo e dias de culto
  app.get(
    "/presenca-culto/minha",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Meus registros, resumo e calendário do mês" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { inicio, fim } = mesDaQuery(request.query);
        const userId = request.user.id;
        const [registros, resumo, calendario] = await Promise.all([
          listarRegistrosDoUsuario(userId, inicio, fim),
          resumoDoUsuario(userId, inicio, fim),
          datasDoCalendario(inicio, fim),
        ]);
        return { data: { registros: registros.map(formatarRegistro), resumo, calendario } };
      });
    },
  );

  // Minha posição no período vigente (o colaborador só vê a própria)
  app.get(
    "/presenca-culto/minha/ranking",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Minha posição e aproveitamento no período vigente" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const periodo = await periodoVigente(hojeISO());
        if (!periodo) return { data: null };

        const inicio = paraDataISO(periodo.data_inicio);
        const fim = paraDataISO(periodo.data_fim);
        const ranking = await rankingDoPeriodo(inicio, fim);
        const meu = ranking.find((i) => i.user_id === request.user.id) ?? null;

        return {
          data: {
            periodo: { ...periodo, data_inicio: inicio, data_fim: fim },
            total_participantes: ranking.length,
            meu,
          },
        };
      });
    },
  );

  // Detalhe de um registro + histórico
  app.get(
    "/presenca-culto/registros/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Detalhe de um registro de presença" },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const r = await buscarRegistro(request.params.id);
        if (!r) return reply.code(404).send({ message: "Registro não encontrado." });
        if (!(await podeVerRegistro(r, request.user))) {
          return reply.code(403).send({ message: "Sem permissão para ver este registro." });
        }
        const historico = await listarHistorico(r.id);
        return { data: { ...formatarRegistro(r), historico } };
      });
    },
  );

  // Envia o anexo ANTES de justificar; devolve { path, nome, mime } pra mandar na justificativa
  app.post(
    "/presenca-culto/anexos",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Envia o anexo da justificativa (PDF ou imagem)", consumes: ["multipart/form-data"] },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const file = await request.file();
        if (!file) return reply.code(400).send({ message: "Nenhum arquivo enviado." });

        const buffer = await file.toBuffer();
        const erro = validarAnexo(file.mimetype, buffer.length);
        if (erro) return reply.code(415).send({ message: erro });

        const extensao = extname(file.filename) || "";
        const path = `${ANEXO_PASTA_MINIO}/${request.user.id}/${randomUUID()}${extensao}`;

        try {
          await uploadObject(path, buffer, file.mimetype);
        } catch (error) {
          request.log.error({ error }, "Falha ao enviar anexo pro MinIO");
          return reply.code(500).send({ message: "Não foi possível enviar o anexo." });
        }

        return reply.code(201).send({ data: { path, nome: file.filename, mime: file.mimetype } });
      });
    },
  );

  // Baixa o anexo (a API repassa; o navegador nunca acessa o MinIO)
  app.get(
    "/presenca-culto/registros/:id/anexo",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Baixa o anexo da justificativa" },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const r = await buscarRegistro(request.params.id);
        if (!r || !r.anexo_path) return reply.code(404).send({ message: "Anexo não encontrado." });
        if (!(await podeVerRegistro(r, request.user))) {
          return reply.code(403).send({ message: "Sem permissão para ver este anexo." });
        }
        const { body, contentType } = await getObjectStream(r.anexo_path);
        reply.header("Content-Type", contentType);
        if (r.anexo_nome) {
          reply.header("Content-Disposition", `inline; filename="${encodeURIComponent(r.anexo_nome)}"`);
        }
        return reply.send(body);
      });
    },
  );

  // Colaborador justifica a própria falta
  app.post(
    "/presenca-culto/registros/:id/justificar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags,
        summary: "Justifica a própria falta",
        body: {
          type: "object",
          required: ["tipo_justificativa", "justificativa_texto"],
          properties: {
            tipo_justificativa: { type: "string" },
            justificativa_texto: { type: "string", minLength: 1 },
            anexo: schemaAnexo,
          },
          additionalProperties: false,
        },
      },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { tipo_justificativa, justificativa_texto, anexo } = request.body;
        const userId = request.user.id;

        const erro =
          validarJustificativa(tipo_justificativa, justificativa_texto) ?? anexoDoUsuario(anexo, userId);
        if (erro) return reply.code(400).send({ message: erro });

        const ctx = await buscarUsuarioComAprovadores(userId);
        if (!ctx) return reply.code(404).send({ message: "Usuário não encontrado." });
        if (typeof ctx.aprovadores === "string") return reply.code(400).send({ message: ctx.aprovadores });
        const aprovadores = ctx.aprovadores;

        const res = await aplicarTransicao(request.params.id, userId, (r) => {
          const motivo = motivoNaoPodeJustificarPropria(r, userId);
          if (motivo) return motivo;
          return {
            acao: ACAO_HISTORICO.JUSTIFICOU,
            patch: patchJustificar({
              tipo: tipo_justificativa,
              texto: justificativa_texto,
              autorId: userId,
              aprovadores,
              porLider: false,
              anexo: anexo ?? null,
            }),
          };
        });
        if ("erro" in res) return reply.code(res.status!).send({ message: res.erro });

        const registro = res.data!.atualizado;
        const destino = registro.lider_id ?? registro.final_aprovador_id;
        await notificar(request, destino, {
          tipo: "PRESENCA_JUSTIFICATIVA_PENDENTE",
          acao: "justificou uma falta no culto e aguarda sua aprovação",
          detalhe: `${paraDataISO(registro.data)} — ${tipo_justificativa}`,
          referenciaId: registro.id,
        });

        return { data: formatarRegistro(registro) };
      });
    },
  );

  /* ── Líder (gerente / coordenador) ───────────────────────────────────── */

  // Minha equipe com a contagem do mês
  app.get(
    "/presenca-culto/equipe",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Equipe do líder com contagem por status no mês" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { inicio, fim } = mesDaQuery(request.query);
        const equipe = await listarEquipeDoLider(request.user.id);
        const contagens = await contarPorUsuario(
          equipe.map((u: any) => u.id),
          inicio,
          fim,
        );
        const porUsuario = new Map(contagens.map((c: any) => [c.user_id, c]));
        const vazio = { presentes: 0, atrasos: 0, faltas: 0, em_aprovacao: 0, justificados: 0 };

        const data = equipe.map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          foto_url: avatarUrl(u.id, u.foto_url),
          setor_nome: u.setor_nome,
          contagem: { ...vazio, ...(porUsuario.get(u.id) ?? {}), user_id: undefined },
        }));
        return { data, total: data.length };
      });
    },
  );

  // Registros e resumo de um membro da equipe
  app.get(
    "/presenca-culto/equipe/:userId",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Registros e resumo do mês de um membro da equipe" },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { userId } = request.params;
        const ctx = await buscarUsuarioComAprovadores(userId);
        if (!ctx) return reply.code(404).send({ message: "Usuário não encontrado." });

        const souLider = typeof ctx.aprovadores !== "string" && ctx.aprovadores.lider_id === request.user.id;
        if (!souLider && !ehVisaoGeral(request.user.papelCodigo)) {
          return reply.code(403).send({ message: "Este colaborador não é da sua equipe." });
        }

        const { inicio, fim } = mesDaQuery(request.query);
        const [registros, resumo] = await Promise.all([
          listarRegistrosDoUsuario(userId, inicio, fim),
          resumoDoUsuario(userId, inicio, fim),
        ]);
        return {
          data: {
            usuario: { ...ctx.usuario, foto_url: avatarUrl(ctx.usuario.id, ctx.usuario.foto_url) },
            registros: registros.map(formatarRegistro),
            resumo,
          },
        };
      });
    },
  );

  // Líder justifica faltas por um ou mais membros da equipe (tudo ou nada)
  app.post(
    "/presenca-culto/equipe/justificar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags,
        summary: "Líder justifica faltas pela equipe (afastamento, férias...)",
        body: {
          type: "object",
          required: ["presenca_ids", "tipo_justificativa", "justificativa_texto"],
          properties: {
            presenca_ids: { type: "array", minItems: 1, items: { type: "string" } },
            tipo_justificativa: { type: "string" },
            justificativa_texto: { type: "string", minLength: 1 },
            anexo: schemaAnexo,
          },
          additionalProperties: false,
        },
      },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { presenca_ids, tipo_justificativa, justificativa_texto, anexo } = request.body;
        const liderId = request.user.id;

        const erro =
          validarJustificativa(tipo_justificativa, justificativa_texto) ?? anexoDoUsuario(anexo, liderId);
        if (erro) return reply.code(400).send({ message: erro });

        // Resolve os aprovadores de cada dono de registro (cache por usuário)
        const ids: string[] = [...new Set<string>(presenca_ids)];
        const aprovadoresPorUsuario = new Map<string, any>();
        for (const id of ids) {
          const r = await buscarRegistro(id);
          if (!r) return reply.code(404).send({ message: "Registro não encontrado." });
          if (!r.user_id) return reply.code(400).send({ message: "Registro sem colaborador vinculado." });
          if (!aprovadoresPorUsuario.has(r.user_id)) {
            const ctx = await buscarUsuarioComAprovadores(r.user_id);
            if (!ctx) return reply.code(404).send({ message: "Colaborador não encontrado." });
            if (typeof ctx.aprovadores === "string") return reply.code(400).send({ message: ctx.aprovadores });
            aprovadoresPorUsuario.set(r.user_id, ctx.aprovadores);
          }
        }

        const res = await aplicarTransicaoEmLote(ids, liderId, (r) => {
          const aprovadores = aprovadoresPorUsuario.get(r.user_id!);
          const motivo = motivoNaoPodeJustificarPor(r, liderId, aprovadores);
          if (motivo) return `${paraDataISO(r.data)}: ${motivo}`;
          return {
            acao: ACAO_HISTORICO.JUSTIFICOU,
            comentario: "Justificado pelo líder",
            patch: patchJustificar({
              tipo: tipo_justificativa,
              texto: justificativa_texto,
              autorId: liderId,
              aprovadores,
              porLider: true,
              anexo: anexo ?? null,
            }),
          };
        });
        if ("erro" in res) return reply.code(res.status!).send({ message: res.erro });

        const registros = res.data!.map((x: any) => x.atualizado);

        // Uma notificação por aprovador final, com a quantidade de datas
        const porFinal = new Map<string, number>();
        for (const r of registros) porFinal.set(r.final_aprovador_id, (porFinal.get(r.final_aprovador_id) ?? 0) + 1);
        for (const [finalId, qtd] of porFinal) {
          await notificar(request, finalId, {
            tipo: "PRESENCA_JUSTIFICATIVA_PENDENTE",
            acao: `justificou ${qtd} falta(s) no culto pela equipe e aguarda sua aprovação`,
            detalhe: tipo_justificativa,
            referenciaId: qtd === 1 ? registros[0].id : null,
          });
        }

        return { data: registros.map(formatarRegistro), total: registros.length };
      });
    },
  );

  /* ── Aprovações ──────────────────────────────────────────────────────── */

  // O que espera a MINHA decisão (como líder e como aprovador final)
  app.get(
    "/presenca-culto/aprovacoes/minhas",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Justificativas aguardando a minha decisão" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const [lider, final] = await Promise.all([
          filaDoLider(request.user.id),
          filaFinal(request.user.id),
        ]);
        return {
          data: {
            lider: lider.map(formatarJustificativa),
            final: final.map(formatarJustificativa),
          },
        };
      });
    },
  );

  // Visão geral do mês (RH/Admin/Tesoureiro) — ?etapa=AGUARDANDO_LIDER|AGUARDANDO_FINAL|CONCLUIDA
  app.get(
    "/presenca-culto/aprovacoes",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_VISAO_GERAL as string[])],
      schema: { tags, summary: "Todas as justificativas do mês (visão geral)" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { inicio, fim } = mesDaQuery(request.query);
        const etapa = request.query?.etapa;
        const lista = (await listarJustificativas(inicio, fim))
          .map(formatarJustificativa)
          .filter((r: any) => !etapa || r.etapa === etapa);
        return { data: lista, total: lista.length };
      });
    },
  );

  // Decisão do líder: APROVAR | NEGAR | DEVOLVER (segunda chance, 1x)
  app.post(
    "/presenca-culto/registros/:id/decisao-lider",
    {
      onRequest: [app.authenticate],
      schema: {
        tags,
        summary: "Líder aprova, nega ou devolve a justificativa",
        body: {
          type: "object",
          required: ["acao"],
          properties: {
            acao: { type: "string", enum: ["APROVAR", "NEGAR", "DEVOLVER"] },
            comentario: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { acao, comentario } = request.body;
        const erro = validarComentarioObrigatorio(acao, comentario);
        if (erro) return reply.code(400).send({ message: erro });

        const acaoHistorico = {
          APROVAR: ACAO_HISTORICO.LIDER_APROVOU,
          NEGAR: ACAO_HISTORICO.LIDER_NEGOU,
          DEVOLVER: ACAO_HISTORICO.LIDER_DEVOLVEU,
        }[acao as "APROVAR" | "NEGAR" | "DEVOLVER"];

        const res = await aplicarTransicao(request.params.id, request.user.id, (r) => {
          const motivo = motivoNaoPodeDecidirLider(r, request.user.id, acao);
          if (motivo) return motivo;
          return { acao: acaoHistorico, comentario: comentario ?? null, patch: patchDecisaoLider(r, acao, comentario) };
        });
        if ("erro" in res) return reply.code(res.status!).send({ message: res.erro });

        const { anterior, atualizado } = res.data!;
        const data = paraDataISO(atualizado.data);

        if (acao === "APROVAR") {
          await notificar(request, atualizado.final_aprovador_id, {
            tipo: "PRESENCA_JUSTIFICATIVA_PENDENTE",
            acao: "aprovou uma justificativa de falta no culto, que aguarda sua decisão final",
            detalhe: `${data} — ${atualizado.tipo_justificativa}`,
            referenciaId: atualizado.id,
          });
        } else if (acao === "NEGAR") {
          await notificar(request, atualizado.user_id, {
            tipo: "PRESENCA_JUSTIFICATIVA_NEGADA",
            acao: "negou sua justificativa de falta no culto",
            detalhe: `${data} — ${comentario}`,
            referenciaId: atualizado.id,
          });
        } else {
          await notificar(request, anterior.user_id, {
            tipo: "PRESENCA_JUSTIFICATIVA_DEVOLVIDA",
            acao: "devolveu sua justificativa de falta no culto para você corrigir",
            detalhe: `${data} — ${comentario}`,
            referenciaId: atualizado.id,
          });
        }

        return { data: formatarRegistro(atualizado) };
      });
    },
  );

  // Decisão final: APROVAR | NEGAR
  app.post(
    "/presenca-culto/registros/:id/decisao-final",
    {
      onRequest: [app.authenticate],
      schema: {
        tags,
        summary: "Aprovador final aprova ou nega a justificativa",
        body: {
          type: "object",
          required: ["acao"],
          properties: {
            acao: { type: "string", enum: ["APROVAR", "NEGAR"] },
            comentario: { type: "string" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { acao, comentario } = request.body;
        const erro = validarComentarioObrigatorio(acao, comentario);
        if (erro) return reply.code(400).send({ message: erro });

        const res = await aplicarTransicao(request.params.id, request.user.id, (r) => {
          const motivo = motivoNaoPodeDecidirFinal(r, request.user.id);
          if (motivo) return motivo;
          return {
            acao: acao === "APROVAR" ? ACAO_HISTORICO.FINAL_APROVOU : ACAO_HISTORICO.FINAL_NEGOU,
            comentario: comentario ?? null,
            patch: patchDecisaoFinal(r, acao, comentario),
          };
        });
        if ("erro" in res) return reply.code(res.status!).send({ message: res.erro });

        const r = res.data!.atualizado;
        const data = paraDataISO(r.data);
        const aprovada = acao === "APROVAR";

        // Avisa quem faltou e, se foi o líder que justificou, ele também
        const destinatarios = new Set([r.user_id, r.justificado_por].filter(Boolean) as string[]);
        for (const destino of destinatarios) {
          await notificar(request, destino, {
            tipo: aprovada ? "PRESENCA_JUSTIFICATIVA_APROVADA" : "PRESENCA_JUSTIFICATIVA_NEGADA",
            acao: aprovada
              ? "aprovou a justificativa de falta no culto"
              : "negou a justificativa de falta no culto",
            detalhe: aprovada ? `${data} — ${r.tipo_justificativa}` : `${data} — ${comentario}`,
            referenciaId: r.id,
          });
        }

        return { data: formatarRegistro(r) };
      });
    },
  );

  /* ── Calendário ──────────────────────────────────────────────────────── */

  app.get(
    "/presenca-culto/calendario",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Dias de culto do mês" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { inicio, fim } = mesDaQuery(request.query);
        const dias = await listarCalendario(inicio, fim);
        const data = dias.map((d: any) => ({ ...d, data: paraDataISO(d.data) }));
        return { data, total: data.length };
      });
    },
  );

  // Substitui os dias de culto do mês (botão "Salvar" da tela Datas)
  app.put(
    "/presenca-culto/calendario",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: {
        tags,
        summary: "Define os dias de culto de um mês",
        body: {
          type: "object",
          required: ["ano", "mes", "datas"],
          properties: {
            ano: { type: "number", minimum: 2020 },
            mes: { type: "number", minimum: 1, maximum: 12 },
            datas: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { ano, mes, datas } = request.body;
        const salvas = await salvarCalendarioDoMes(ano, mes, datas, request.user.id);
        return { data: salvas, total: salvas.length };
      });
    },
  );

  /* ── Gestão do RH ────────────────────────────────────────────────────── */

  // Todos os registros de um dia (tela de ajuste manual) — ?data=YYYY-MM-DD
  app.get(
    "/presenca-culto/registros",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: { tags, summary: "Registros de todos os colaboradores em um dia" },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const data = request.query?.data ?? hojeISO();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
          return reply.code(400).send({ message: "Data inválida. Use YYYY-MM-DD." });
        }
        const lista = (await listarRegistrosPorData(data)).map((r: any) => ({
          ...formatarRegistro(r),
          usuario_foto: avatarUrl(r.user_id, r.usuario_foto),
        }));
        return { data: lista, total: lista.length };
      });
    },
  );

  // Ajuste manual (câmera não pegou etc.)
  app.patch(
    "/presenca-culto/registros/:id/ajuste",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: {
        tags,
        summary: "RH ajusta status, hora e pontuação de um registro",
        body: {
          type: "object",
          required: ["comentario"],
          properties: {
            status: { type: "string", enum: ["Presente", "Falta", "Atraso"] },
            hora: { type: ["string", "null"] },
            pontuacao: { type: "integer" },
            comentario: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const input = request.body;
        const res = await aplicarTransicao(request.params.id, request.user.id, (r) => {
          const motivo = motivoNaoPodeAjustar(r);
          if (motivo) return motivo;
          const patch = patchAjusteManual(r, input);
          if (typeof patch === "string") return patch;
          return { acao: ACAO_HISTORICO.AJUSTE_MANUAL, comentario: input.comentario, patch };
        });
        if ("erro" in res) return reply.code(res.status!).send({ message: res.erro });

        const r = res.data!.atualizado;
        await notificar(request, r.user_id, {
          tipo: "PRESENCA_AJUSTE_MANUAL",
          acao: "ajustou seu registro de presença no culto",
          detalhe: `${paraDataISO(r.data)} — ${r.status}${r.hora ? ` às ${String(r.hora).slice(0, 5)}` : ""}`,
          referenciaId: r.id,
        });

        return { data: formatarRegistro(r) };
      });
    },
  );

  // Registros cujo código APS não casou com nenhum usuário
  app.get(
    "/presenca-culto/sem-usuario",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: { tags, summary: "Registros sem colaborador vinculado (código APS não encontrado)" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const { inicio, fim } = mesDaQuery(request.query);
        const lista = (await listarRegistrosSemUsuario(inicio, fim)).map(formatarRegistro);
        return { data: lista, total: lista.length };
      });
    },
  );

  // Lista de usuários (pra escolher superior do setor, filtros etc.)
  app.get(
    "/presenca-culto/usuarios",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: { tags, summary: "Usuários ativos (id, nome, setor, papel)" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const lista = (await listarUsuarios()).map((u: any) => ({
          id: u.id,
          nome: u.nome,
          email: u.email,
          foto_url: avatarUrl(u.id, u.foto_url),
          setor_id: u.setor_id,
          setor_nome: u.setor_nome,
          papel: u.papel,
        }));
        return { data: lista, total: lista.length };
      });
    },
  );

  /* ── Superior do setor ───────────────────────────────────────────────── */

  app.get(
    "/presenca-culto/setores",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: { tags, summary: "Setores com gestor e superior configurados" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const lista = await listarSetoresComSuperior();
        return { data: lista, total: lista.length };
      });
    },
  );

  app.put(
    "/presenca-culto/setores/:setorId/superior",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: {
        tags,
        summary: "Define quem aprova quando quem faltou é o gestor do setor",
        body: {
          type: "object",
          required: ["superior_id"],
          properties: { superior_id: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        try {
          const linha = await definirSuperiorDoSetor(
            request.params.setorId,
            request.body.superior_id,
            request.user.id,
          );
          return { data: linha };
        } catch (error) {
          request.log.warn({ error }, "Falha ao definir superior do setor");
          return reply.code(400).send({ message: "Setor ou usuário inválido." });
        }
      });
    },
  );

  app.delete(
    "/presenca-culto/setores/:setorId/superior",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: { tags, summary: "Remove o superior configurado do setor" },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const removido = await removerSuperiorDoSetor(request.params.setorId);
        if (!removido) return reply.code(404).send({ message: "Nenhum superior configurado para este setor." });
        return { data: { setor_id: request.params.setorId } };
      });
    },
  );

  /* ── Períodos de premiação ───────────────────────────────────────────── */

  const schemaPeriodo = {
    type: "object",
    properties: {
      nome: { type: "string", minLength: 1 },
      data_inicio: { type: "string" },
      data_fim: { type: "string" },
      data_premiacao: { type: ["string", "null"] },
      recurso_inicio: { type: ["string", "null"] },
      recurso_fim: { type: ["string", "null"] },
      fechado: { type: "boolean" },
    },
    additionalProperties: false,
  };

  app.get(
    "/presenca-culto/periodos",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Períodos de premiação" },
    },
    async (request: any) => {
      return rodaComoUsuario(request.user, async () => {
        const lista = await listarPeriodos();
        return { data: lista, total: lista.length };
      });
    },
  );

  app.post(
    "/presenca-culto/periodos",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: {
        tags,
        summary: "Cria um período de premiação",
        body: { ...schemaPeriodo, required: ["nome", "data_inicio", "data_fim"] },
      },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        try {
          const periodo = await criarPeriodo(request.body, request.user.id);
          return reply.code(201).send({ data: periodo });
        } catch (error) {
          request.log.warn({ error }, "Falha ao criar período");
          return reply.code(400).send({ message: "Datas do período inválidas." });
        }
      });
    },
  );

  app.patch(
    "/presenca-culto/periodos/:id",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: { tags, summary: "Atualiza (ou fecha) um período de premiação", body: schemaPeriodo },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        try {
          const periodo = await atualizarPeriodo(request.params.id, request.body);
          if (!periodo) return reply.code(404).send({ message: "Período não encontrado." });
          return { data: periodo };
        } catch (error) {
          request.log.warn({ error }, "Falha ao atualizar período");
          return reply.code(400).send({ message: "Datas do período inválidas." });
        }
      });
    },
  );

  app.delete(
    "/presenca-culto/periodos/:id",
    {
      onRequest: [app.authenticate, somentePapeis(PAPEIS_GESTAO_MODULO as string[])],
      schema: { tags, summary: "Exclui um período de premiação" },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const removido = await excluirPeriodo(request.params.id);
        if (!removido) return reply.code(404).send({ message: "Período não encontrado." });
        return { data: { id: request.params.id } };
      });
    },
  );

  /* ── Ranking ─────────────────────────────────────────────────────────── */

  // RH/Admin: todos. Líder: só a própria equipe. ?periodoId=... (padrão: vigente)
  app.get(
    "/presenca-culto/ranking",
    {
      onRequest: [app.authenticate],
      schema: { tags, summary: "Ranking do período (RH/Admin: todos; líder: sua equipe)" },
    },
    async (request: any, reply: any) => {
      return rodaComoUsuario(request.user, async () => {
        const periodo = request.query?.periodoId
          ? await buscarPeriodo(request.query.periodoId)
          : await periodoVigente(hojeISO());
        if (!periodo) return reply.code(404).send({ message: "Nenhum período de premiação encontrado." });

        let userIds: string[] | undefined;
        if (!ehGestaoModulo(request.user.papelCodigo)) {
          const equipe = await listarEquipeDoLider(request.user.id);
          if (!equipe.length) {
            return reply.code(403).send({ message: "Sem permissão para ver o ranking." });
          }
          userIds = equipe.map((u: any) => u.id);
        }

        const inicio = paraDataISO(periodo.data_inicio);
        const fim = paraDataISO(periodo.data_fim);
        const ranking = (await rankingDoPeriodo(inicio, fim, userIds)).map((i) => ({
          ...i,
          foto_url: avatarUrl(i.user_id, i.foto_url),
        }));

        return {
          data: {
            periodo: { ...periodo, data_inicio: inicio, data_fim: fim },
            ranking,
          },
          total: ranking.length,
        };
      });
    },
  );
}
