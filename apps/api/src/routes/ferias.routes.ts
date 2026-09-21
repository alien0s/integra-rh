import type { FastifyInstance } from "fastify";

import {
  aceitarAjusteSolicitacao,
  aprovarSolicitacao,
  atualizarExcecaoFerias,
  cancelarSolicitacao,
  confirmarSolicitacao,
  criarSolicitacao,
  ehGestorDaSolicitacao,
  excluirSolicitacao,
  getResumoFerias,
  getSolicitacaoParaNotificar,
  listExcecoesFerias,
  listMinhasSolicitacoes,
  listSolicitacoes,
  listSolicitacoesEquipe,
  listVisaoGeral,
  recusarSolicitacao,
  registrarFeriasManual,
  sugerirAjusteSolicitacao,
  SolicitacaoFeriasInvalidaError,
  SolicitacaoFeriasJaAprovadaError,
  SolicitacaoFeriasPendenteError,
  type AtualizarExcecaoFeriasInput,
  type CriarSolicitacaoInput,
  type ExcecaoFeriasDTO,
  type FeriasResumoDTO,
  type MinhaSolicitacaoDTO,
  type RegistrarFeriasManualInput,
  type SolicitacaoFeriasDTO,
  type VisaoGeralFeriasDTO,
} from "../lib/ferias.js";
import { emitirParaPapeis, emitirParaUsuario } from "../lib/notificacoes.js";
import { bloquearColaborador, exigirPapeis } from "../plugins/auth.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/** Papéis que podem registrar férias/folga manualmente (histórico/retroativo). */
const PAPEIS_QUE_PODEM_REGISTRAR_FERIAS_MANUAL = new Set([
  "ADMIN",
  "RH",
  "COORDENADOR DP",
]);

const PAPEL_COORD_DP = "COORDENADOR DP";
const PAPEL_RH = "RH";

/** "Primeiro Último" a partir do nome completo (ex.: "Enos Cardoso de Franca" -> "Enos Franca"). */
function primeiroEUltimoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return nome.trim();
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/**
 * Quem confirma (2ª etapa) a solicitação, conforme o PAPEL do solicitante:
 *   - solicitante é COORDENADOR DP → confirma o RH (ele está acima do coord.);
 *   - qualquer outro → confirma o COORDENADOR DP.
 */
function papeisQueConfirmam(solicitantePapel: string | null): string[] {
  return solicitantePapel === PAPEL_COORD_DP ? [PAPEL_RH] : [PAPEL_COORD_DP];
}

/** O usuário é o confirmador correto para este solicitante? (ADMIN/dev passam.) */
function ehConfirmadorCorreto(
  papelUsuario: string | undefined,
  solicitantePapel: string | null,
): boolean {
  if (papelUsuario === undefined || papelUsuario === "ADMIN") return true;
  return papeisQueConfirmam(solicitantePapel).includes(papelUsuario);
}

/**
 * Rotas de Férias/Folga. Fluxo de aprovação em duas etapas:
 *   criar → notifica o GESTOR do setor (acionável). Sem gestor → vai ao confirmador.
 *   gestor aprova → notifica o confirmador (COORD. DP; ou RH se o solicitante é
 *     COORD. DP) + o colaborador (informativa).
 *   confirmador confirma → notifica o colaborador. Recusa/cancelamento → notifica.
 */
export async function feriasRoutes(app: FastifyInstance) {
  /* ── Leitura ─────────────────────────────────────────────────────────── */

  // Visão geral (gestor/DP/RH): todas as solicitações. COLABORADOR usa
  // /ferias/minhas — bloqueado aqui pra não contornar batendo na API direto.
  app.get<{ Reply: ApiListResponse<SolicitacaoFeriasDTO> }>(
    "/ferias",
    {
      onRequest: [app.authenticate, bloquearColaborador],
      schema: { tags: ["Férias"], summary: "Lista todas as solicitações" },
    },
    async (request) => {
      // GESTOR só vê a própria equipe; DP/RH/ADMIN veem todas.
      const gestorId =
        request.user.papelCodigo === "GESTOR" ? request.user.id : undefined;
      const solicitacoes = await listSolicitacoes(gestorId);
      return { data: solicitacoes, total: solicitacoes.length };
    },
  );

  // Aba Pessoal: histórico do próprio colaborador.
  app.get<{ Reply: ApiListResponse<MinhaSolicitacaoDTO> }>(
    "/ferias/minhas",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Histórico do próprio colaborador" },
    },
    async (request) => {
      const minhas = await listMinhasSolicitacoes(request.user.id);
      return { data: minhas, total: minhas.length };
    },
  );

  // Aba Pessoal: resumo do saldo (cards do topo).
  app.get<{ Reply: ApiResponse<FeriasResumoDTO> }>(
    "/ferias/resumo",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Resumo do saldo do colaborador" },
    },
    async (request) => {
      return { data: await getResumoFerias(request.user.id) };
    },
  );

  // Calendário da equipe (GESTOR): férias em andamento/aprovadas do seu setor.
  app.get<{ Reply: ApiListResponse<SolicitacaoFeriasDTO> }>(
    "/ferias/equipe",
    {
      onRequest: [app.authenticate, exigirPapeis("GESTOR")],
      schema: { tags: ["Férias"], summary: "Férias da equipe do gestor" },
    },
    async (request) => {
      const equipe = await listSolicitacoesEquipe(request.user.id);
      return { data: equipe, total: equipe.length };
    },
  );

  // Visão geral do DP/RH: quem vai entrar de férias e quem precisa tirar.
  app.get<{
    Querystring: { mes?: string };
    Reply: ApiResponse<VisaoGeralFeriasDTO> | { message: string };
  }>(
    "/ferias/geral",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP", "RH")],
      schema: {
        tags: ["Férias"],
        summary: "Visão geral (DP/RH): quem entra e quem precisa tirar férias",
        querystring: {
          type: "object",
          properties: { mes: { type: "string" } }, // YYYY-MM
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      return { data: await listVisaoGeral(request.query.mes) };
    },
  );

  // Aba "Exceções" (DP/COORDENADOR DP/ADMIN): quem pode fracionar/vender.
  app.get<{ Reply: ApiListResponse<ExcecaoFeriasDTO> }>(
    "/ferias/excecoes",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: {
        tags: ["Férias"],
        summary: "Lista os colaboradores e suas exceções de fracionamento/venda",
      },
    },
    async () => {
      const excecoes = await listExcecoesFerias();
      return { data: excecoes, total: excecoes.length };
    },
  );

  // Liga/desliga as exceções de um colaborador (DP/COORDENADOR DP/ADMIN).
  app.patch<{
    Params: { usuarioId: string };
    Body: AtualizarExcecaoFeriasInput;
    Reply: ApiResponse<ExcecaoFeriasDTO> | { message: string };
  }>(
    "/ferias/excecoes/:usuarioId",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP")],
      schema: {
        tags: ["Férias"],
        summary: "Atualiza as exceções de fracionamento/venda de um colaborador",
        body: {
          type: "object",
          required: ["podeFracionarFerias", "podeVenderFerias"],
          properties: {
            podeFracionarFerias: { type: "boolean" },
            podeVenderFerias: { type: "boolean" },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const atualizado = await atualizarExcecaoFerias(request.params.usuarioId, request.body);
      if (!atualizado) {
        return reply.code(404).send({ message: "Usuário não encontrado." });
      }
      return { data: atualizado };
    },
  );

  /* ── Escrita ─────────────────────────────────────────────────────────── */

  // Nova solicitação (o colaborador logado).
  app.post<{
    Body: CriarSolicitacaoInput;
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Férias"],
        summary: "Cria uma solicitação de férias/folga",
        body: {
          type: "object",
          required: ["tipo", "dataInicio", "dataFim"],
          properties: {
            tipo: { type: "string", enum: ["FERIAS", "FOLGA"] },
            dataInicio: { type: "string" }, // YYYY-MM-DD
            dataFim: { type: "string" },
            observacoes: { type: ["string", "null"] },
            // Dias vendidos (abono) — só aceito se o colaborador tiver a
            // exceção pode_vender_ferias (checado de novo em criarSolicitacao).
            diasVendidos: { type: "integer", minimum: 0, maximum: 10 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      let resultado;
      try {
        resultado = await criarSolicitacao(request.user.id, request.body);
      } catch (error) {
        if (
          error instanceof SolicitacaoFeriasPendenteError ||
          error instanceof SolicitacaoFeriasJaAprovadaError
        ) {
          return reply.code(409).send({ message: error.message });
        }
        if (error instanceof SolicitacaoFeriasInvalidaError) {
          return reply.code(400).send({ message: error.message });
        }
        throw error;
      }

      const { solicitacao, statusInicial, gestorId } = resultado;
      const verbo =
        request.body.tipo === "FOLGA" ? "solicitou folga" : "solicitou férias";

      if (statusInicial === "PENDENTE" && gestorId) {
        // 1ª etapa: notifica o gestor do setor (acionável).
        await emitirParaUsuario(gestorId, {
          atorId: request.user.id,
          tipo: `${request.body.tipo}_SOLICITADA`,
          acao: verbo,
          detalhe: solicitacao.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: solicitacao.id,
          requerAcao: true,
        });
      } else {
        // Sem gestor no setor (fallback): já vai ao confirmador (COORD. DP, ou
        // RH se o próprio solicitante for COORD. DP).
        await emitirParaPapeis(papeisQueConfirmam(solicitacao.solicitantePapel ?? null), {
          atorId: request.user.id,
          tipo: `${request.body.tipo}_AGUARDA_DP`,
          acao: verbo,
          detalhe: solicitacao.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: solicitacao.id,
          requerAcao: true,
        });
      }

      return { data: solicitacao };
    },
  );

  // Registro manual (DP/RH/Admin): férias/folga que já aconteceram fora do
  // sistema. Não emite notificação nem passa por aprovação.
  app.post<{
    Body: RegistrarFeriasManualInput;
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/registrar-manual",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Férias"],
        summary: "DP/RH/Admin registra manualmente férias/folga já ocorridas",
        body: {
          type: "object",
          required: ["usuarioId", "tipo", "dataInicio", "dataFim"],
          properties: {
            usuarioId: { type: "string", minLength: 1 },
            tipo: { type: "string", enum: ["FERIAS", "FOLGA"] },
            dataInicio: { type: "string" }, // YYYY-MM-DD
            dataFim: { type: "string" },
            observacoes: { type: ["string", "null"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const papel = request.user.papelCodigo;
      // papel undefined = modo dev (auth desativada) — libera.
      if (papel !== undefined && !PAPEIS_QUE_PODEM_REGISTRAR_FERIAS_MANUAL.has(papel)) {
        return reply
          .code(403)
          .send({ message: "Sem permissão para registrar férias manualmente." });
      }

      const { dataInicio, dataFim } = request.body;
      if (new Date(dataFim) < new Date(dataInicio)) {
        return reply
          .code(400)
          .send({ message: "A data final não pode ser antes da data inicial." });
      }

      const registrada = await registrarFeriasManual(
        { ...request.body, observacoes: request.body.observacoes ?? null },
        request.user.id,
      );

      return reply.code(201).send({ data: registrada });
    },
  );

  // 1ª etapa — GESTOR do setor aprova (PENDENTE → APROVADO_GESTOR).
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/aprovar",
    {
      onRequest: [app.authenticate, exigirPapeis("GESTOR")],
      schema: { tags: ["Férias"], summary: "Gestor aprova (1ª etapa)" },
    },
    async (request, reply) => {
      const info = await getSolicitacaoParaNotificar(request.params.id);
      if (!info) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }
      // Ninguém decide sobre a própria solicitação.
      if (info.userId === request.user.id) {
        return reply
          .code(403)
          .send({ message: "Você não pode aprovar a sua própria solicitação." });
      }
      // GESTOR só aprova solicitações do PRÓPRIO setor; ADMIN passa direto.
      if (
        request.user.papelCodigo === "GESTOR" &&
        !(await ehGestorDaSolicitacao(request.params.id, request.user.id))
      ) {
        return reply
          .code(403)
          .send({ message: "Você não é o gestor do setor desta solicitação." });
      }

      const dto = await aprovarSolicitacao(request.params.id, request.user.id);
      if (!dto) {
        return reply
          .code(404)
          .send({ message: "Solicitação não encontrada ou já decidida." });
      }

      {
        // Encaminha ao confirmador correto (acionável) e avisa o colaborador.
        await emitirParaPapeis(papeisQueConfirmam(info.solicitantePapel), {
          atorId: request.user.id,
          tipo: "FERIAS_AGUARDA_DP",
          acao: `aprovou férias de ${primeiroEUltimoNome(info.funcionarioNome)}`,
          detalhe: info.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: request.params.id,
          requerAcao: true,
        });
        await emitirParaUsuario(info.userId, {
          atorId: request.user.id,
          tipo: "FERIAS_APROVADA_GESTOR",
          acao: "aprovou sua solicitação (aguardando o DP)",
          detalhe: info.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: request.params.id,
        });
      }

      return { data: dto };
    },
  );

  // 2ª etapa — DP confirma (APROVADO_GESTOR → APROVADO).
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/confirmar",
    {
      onRequest: [app.authenticate, exigirPapeis("COORDENADOR DP", "RH")],
      schema: { tags: ["Férias"], summary: "Confirma a solicitação (2ª etapa)" },
    },
    async (request, reply) => {
      const info = await getSolicitacaoParaNotificar(request.params.id);
      if (!info) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }
      if (info.userId === request.user.id) {
        return reply
          .code(403)
          .send({ message: "Você não pode confirmar a sua própria solicitação." });
      }
      // COORD. DP confirma as dos demais; RH confirma as do COORD. DP.
      if (!ehConfirmadorCorreto(request.user.papelCodigo, info.solicitantePapel)) {
        return reply
          .code(403)
          .send({ message: "Esta solicitação é confirmada por outro papel." });
      }

      const dto = await confirmarSolicitacao(request.params.id, request.user.id);
      if (!dto) {
        return reply
          .code(404)
          .send({ message: "Solicitação não encontrada ou não está aguardando o DP." });
      }

      {
        await emitirParaUsuario(info.userId, {
          atorId: request.user.id,
          tipo: "FERIAS_CONFIRMADA",
          acao: "confirmou suas férias",
          detalhe: info.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: request.params.id,
        });
      }

      return { data: dto };
    },
  );

  // 2ª etapa (alternativa à confirmação) — DP devolve uma sugestão de nova
  // data (APROVADO_GESTOR → AJUSTE_SUGERIDO). Notificação só informativa: o
  // colaborador aceita direto na tela de Férias (aba Pessoal), não pelo
  // cartão de notificação (que só sabe agir em Aprovar/Recusar de férias).
  app.patch<{
    Params: { id: string };
    Body: { dataInicioSugerida: string; motivo: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/sugerir-ajuste",
    {
      onRequest: [app.authenticate, exigirPapeis("COORDENADOR DP", "RH")],
      schema: {
        tags: ["Férias"],
        summary: "DP sugere um novo início pro período, em vez de confirmar (2ª etapa)",
        body: {
          type: "object",
          required: ["dataInicioSugerida", "motivo"],
          properties: {
            dataInicioSugerida: { type: "string" }, // YYYY-MM-DD
            motivo: { type: "string", minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const info = await getSolicitacaoParaNotificar(request.params.id);
      if (!info) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }
      if (info.userId === request.user.id) {
        return reply
          .code(403)
          .send({ message: "Você não pode sugerir um ajuste na sua própria solicitação." });
      }
      if (!ehConfirmadorCorreto(request.user.papelCodigo, info.solicitantePapel)) {
        return reply
          .code(403)
          .send({ message: "Esta solicitação é confirmada por outro papel." });
      }

      let dto;
      try {
        dto = await sugerirAjusteSolicitacao(
          request.params.id,
          request.user.id,
          request.body.dataInicioSugerida,
          request.body.motivo,
        );
      } catch (error) {
        if (error instanceof SolicitacaoFeriasInvalidaError) {
          return reply.code(400).send({ message: error.message });
        }
        throw error;
      }
      if (!dto) {
        return reply
          .code(404)
          .send({ message: "Solicitação não encontrada ou não está aguardando o DP." });
      }

      await emitirParaUsuario(info.userId, {
        atorId: request.user.id,
        tipo: "FERIAS_AJUSTE_SUGERIDO",
        acao: "sugeriu um ajuste na data das suas férias",
        detalhe: dto.periodoSugerido ?? info.periodo,
        referenciaTabela: "ferias_solicitacoes",
        referenciaId: request.params.id,
      });

      return { data: dto };
    },
  );

  // O colaborador aceita o ajuste sugerido pelo DP: aplica a nova data e
  // reinicia o fluxo (gestor aprova de novo, DP confirma de novo). Não há
  // "recusar o ajuste" — pra isso, cancela a solicitação inteira.
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/aceitar-ajuste",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Férias"],
        summary: "Colaborador aceita o ajuste de data sugerido pelo DP",
      },
    },
    async (request, reply) => {
      const resultado = await aceitarAjusteSolicitacao(request.params.id, request.user.id);
      if (!resultado) {
        return reply.code(404).send({
          message: "Solicitação não encontrada ou não está aguardando sua confirmação.",
        });
      }

      const { solicitacao, statusInicial, gestorId } = resultado;
      if (statusInicial === "PENDENTE" && gestorId) {
        await emitirParaUsuario(gestorId, {
          atorId: request.user.id,
          tipo: "FERIAS_SOLICITADA",
          acao: "aceitou o ajuste de data e aguarda aprovação",
          detalhe: solicitacao.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: solicitacao.id,
          requerAcao: true,
        });
      } else {
        await emitirParaPapeis(papeisQueConfirmam(solicitacao.solicitantePapel ?? null), {
          atorId: request.user.id,
          tipo: "FERIAS_AGUARDA_DP",
          acao: "aceitou o ajuste de data e aguarda confirmação",
          detalhe: solicitacao.periodo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: solicitacao.id,
          requerAcao: true,
        });
      }

      return { data: solicitacao };
    },
  );

  // Recusar (gestor em PENDENTE, ou DP em APROVADO_GESTOR) com justificativa.
  app.patch<{
    Params: { id: string };
    Body: { motivo: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/recusar",
    {
      onRequest: [
        app.authenticate,
        exigirPapeis("GESTOR", "COORDENADOR DP", "RH"),
      ],
      schema: {
        tags: ["Férias"],
        summary: "Recusa uma solicitação (com justificativa)",
        body: {
          type: "object",
          required: ["motivo"],
          properties: { motivo: { type: "string", minLength: 1 } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const info = await getSolicitacaoParaNotificar(request.params.id);
      if (!info) {
        return reply.code(404).send({ message: "Solicitação não encontrada." });
      }
      if (info.userId === request.user.id) {
        return reply
          .code(403)
          .send({ message: "Você não pode recusar a sua própria solicitação." });
      }
      const papel = request.user.papelCodigo;
      // GESTOR só recusa do próprio setor (1ª etapa); o confirmador só recusa
      // as solicitações que confirmaria (2ª etapa). ADMIN passa.
      if (
        papel === "GESTOR" &&
        !(await ehGestorDaSolicitacao(request.params.id, request.user.id))
      ) {
        return reply
          .code(403)
          .send({ message: "Você não é o gestor do setor desta solicitação." });
      }
      if (
        (papel === "COORDENADOR DP" || papel === "RH") &&
        !ehConfirmadorCorreto(papel, info.solicitantePapel)
      ) {
        return reply
          .code(403)
          .send({ message: "Esta solicitação é confirmada por outro papel." });
      }

      const dto = await recusarSolicitacao(
        request.params.id,
        request.user.id,
        request.body.motivo,
      );
      if (!dto) {
        return reply
          .code(404)
          .send({ message: "Solicitação não encontrada ou já decidida." });
      }

      {
        await emitirParaUsuario(info.userId, {
          atorId: request.user.id,
          tipo: "FERIAS_RECUSADA",
          acao: "recusou sua solicitação de férias",
          detalhe: request.body.motivo,
          referenciaTabela: "ferias_solicitacoes",
          referenciaId: request.params.id,
        });
      }

      return { data: dto };
    },
  );

  // Cancelar: colaborador dono (antes de confirmar) ou DP/ADMIN (após confirmar).
  app.patch<{
    Params: { id: string };
    Body: { motivo?: string | null };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/cancelar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["Férias"],
        summary: "Cancela uma solicitação",
        body: {
          type: "object",
          properties: { motivo: { type: ["string", "null"] } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const papel = request.user.papelCodigo;
      // Cancelar uma já APROVADA é do confirmador (COORD. DP / RH) ou ADMIN.
      const ehConfirmador =
        papel === "COORDENADOR DP" ||
        papel === "RH" ||
        papel === "ADMIN" ||
        papel === undefined;

      const resultado = await cancelarSolicitacao(
        request.params.id,
        request.user.id,
        ehConfirmador,
        request.body?.motivo ?? null,
      );

      if (!resultado.ok) {
        if (resultado.motivo === "NAO_ENCONTRADA") {
          return reply.code(404).send({ message: "Solicitação não encontrada." });
        }
        return reply
          .code(403)
          .send({ message: "Você não pode cancelar esta solicitação." });
      }

      // Avisa a contraparte: DP cancelou → avisa o dono; dono cancelou → avisa o DP.
      const info = await getSolicitacaoParaNotificar(request.params.id);
      if (info) {
        const donoCancelou = info.userId === request.user.id;
        if (donoCancelou) {
          await emitirParaPapeis(papeisQueConfirmam(info.solicitantePapel), {
            atorId: request.user.id,
            tipo: "FERIAS_CANCELADA",
            acao: "cancelou a solicitação de férias",
            detalhe: info.periodo,
            referenciaTabela: "ferias_solicitacoes",
            referenciaId: request.params.id,
          });
        } else {
          await emitirParaUsuario(info.userId, {
            atorId: request.user.id,
            tipo: "FERIAS_CANCELADA",
            acao: "cancelou suas férias",
            detalhe: info.periodo,
            referenciaTabela: "ferias_solicitacoes",
            referenciaId: request.params.id,
          });
        }
      }

      return { data: resultado.solicitacao };
    },
  );

  // Excluir: só o próprio dono, e só depois de CANCELADA (aba Pessoal —
  // limpar o histórico de algo que já foi cancelado).
  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/ferias/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Exclui uma solicitação já cancelada" },
    },
    async (request, reply) => {
      const resultado = await excluirSolicitacao(request.params.id, request.user.id);

      if (!resultado.ok) {
        if (resultado.motivo === "NAO_ENCONTRADA") {
          return reply.code(404).send({ message: "Solicitação não encontrada." });
        }
        if (resultado.motivo === "NAO_CANCELADA") {
          return reply
            .code(409)
            .send({ message: "Só é possível excluir uma solicitação já cancelada." });
        }
        return reply
          .code(403)
          .send({ message: "Você não pode excluir esta solicitação." });
      }

      return reply.code(204).send(undefined);
    },
  );
}
