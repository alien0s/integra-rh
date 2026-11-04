import type { FastifyInstance } from "fastify";

import {
  aceitarAjusteSolicitacao,
  aprovarSolicitacao,
  aprovarRhSolicitacao,
  atualizarExcecaoFerias,
  cancelarSolicitacao,
  confirmarSolicitacao,
  criarSolicitacao,
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
import { ehEtapaDecisao, podeDecidirEtapa } from "../lib/feriasFluxo.js";
import {
  atualizarFluxoAprovador,
  criarFluxoAprovador,
  excluirFluxoAprovador,
  FluxoAprovadorInvalidoError,
  listFluxoAprovadores,
  type FluxoAprovador,
  type FluxoAprovadorInput,
} from "../lib/fluxoAprovadores.js";
import { rodaComoUsuario } from "../lib/database.js";
import { enviarEmail } from "../lib/email.js";
import { emitirParaPapeis, emitirParaUsuario } from "../lib/notificacoes.js";
import {
  bloquearColaborador,
  exigirAcessoBeta,
  exigirPapeis,
} from "../plugins/auth.js";
import { getApiConfig } from "../plugins/env.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/**
 * Todo handler deste arquivo que toca `ferias_solicitacoes` roda dentro de
 * `rodaComoUsuario` — abre uma transação com a identidade do usuário
 * (`app.user_id`/`app.papel`) pras policies de RLS lerem (ver migration
 * 025_rls_ferias_solicitacoes.sql). As duas rotas de "Exceções"
 * (GET/PATCH /ferias/excecoes...) tocam só `users` — RLS ainda não ligado
 * lá — então ficam de fora, sem essa transação.
 */

/**
 * Selo de destaque do e-mail de confirmação de férias: ícone (mesmo path do
 * "Palmtree" do lucide-react usado na sidebar/cards de férias) + título, em
 * verde — ver `destaqueHtml` em `enviarEmail` (lib/email.ts), que já cuida do
 * cabeçalho padrão por cima disso.
 */
const SVG_COQUEIRO = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/></svg>`;
const DESTAQUE_FERIAS_CONFIRMADAS_HTML = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
  <tr><td align="center" style="padding-bottom:10px;">${SVG_COQUEIRO}</td></tr>
  <tr><td align="center" style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#16a34a;">Férias confirmadas</td></tr>
</table>`;

/** Papéis que podem registrar férias/folga manualmente (histórico/retroativo). */
const PAPEIS_QUE_PODEM_REGISTRAR_FERIAS_MANUAL = new Set([
  "ADMIN",
  "RH",
  "COORDENADOR DP",
]);


/** "Primeiro Último" a partir do nome completo (ex.: "Enos Cardoso de Franca" -> "Enos Franca"). */
function primeiroEUltimoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return nome.trim();
  return `${partes[0]} ${partes[partes.length - 1]}`;
}

/**
 * Fluxo geral: chefia → RH → Assistente; solicitante RH: chefia → Assistente.
 * Coord. DP acompanha tudo e decide a 1ª etapa somente de suas subordinadas DP.
 * Sem gestor, ou sendo o próprio solicitante, o pedido começa na fila do RH.
 */
export async function feriasRoutes(app: FastifyInstance) {
  // Lançamento beta (ver exigirAcessoBeta): ADMIN e quem foi liberado
  // antecipadamente pro módulo "ferias" (configurável na tela Tabelas),
  // espelhando o bloqueio de navegação do front. Roda em TODAS as rotas
  // deste arquivo (hook de plugin, depois de app.authenticate).
  app.addHook("preHandler", exigirAcessoBeta("ferias"));

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
      return rodaComoUsuario(request.user, async () => {
        // GESTOR só vê a própria equipe; DP/RH/ADMIN veem todas.
        const gestorId =
          request.user.papelCodigo === "GESTOR" ? request.user.id : undefined;
        const solicitacoes = await listSolicitacoes(
          gestorId, request.user.papelCodigo === "COORDENADOR DP",
        );
        return { data: solicitacoes, total: solicitacoes.length };
      });
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
      return rodaComoUsuario(request.user, async () => {
        const minhas = await listMinhasSolicitacoes(request.user.id);
        return { data: minhas, total: minhas.length };
      });
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
      return rodaComoUsuario(request.user, async () => {
        return { data: await getResumoFerias(request.user.id) };
      });
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
      return rodaComoUsuario(request.user, async () => {
        const equipe = await listSolicitacoesEquipe(request.user.id);
        return { data: equipe, total: equipe.length };
      });
    },
  );

  // Visão geral do DP/RH: quem vai entrar de férias e quem precisa tirar.
  app.get<{
    Querystring: { mes?: string };
    Reply: ApiResponse<VisaoGeralFeriasDTO> | { message: string };
  }>(
    "/ferias/geral",
    {
      onRequest: [app.authenticate, exigirPapeis("DP", "COORDENADOR DP", "RH", "ASSISTENTE")],
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
      return rodaComoUsuario(request.user, async () => {
        return { data: await listVisaoGeral(request.query.mes) };
      });
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
    async (request) => {
      // 'users' também tem RLS agora (ver 006_users.sql) — precisa do
      // mesmo wrapper, mesmo não tocando ferias_solicitacoes.
      return rodaComoUsuario(request.user, async () => {
        const excecoes = await listExcecoesFerias();
        return { data: excecoes, total: excecoes.length };
      });
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
      return rodaComoUsuario(request.user, async () => {
        const atualizado = await atualizarExcecaoFerias(request.params.usuarioId, request.body);
        if (!atualizado) {
          return reply.code(404).send({ message: "Usuário não encontrado." });
        }
        return { data: atualizado };
      });
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
      return rodaComoUsuario(request.user, async () => {
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
          // Sem chefia: RH solicitante segue direto ao Assistente, demais ao RH.
          const aguardaAssistente = statusInicial === "APROVADO_RH";
          await emitirParaPapeis(aguardaAssistente ? ["ASSISTENTE"] : ["RH"], {
            atorId: request.user.id,
            tipo: `${request.body.tipo}_${aguardaAssistente ? "AGUARDA_ASSISTENTE" : "AGUARDA_RH"}`,
            acao: verbo,
            detalhe: solicitacao.periodo,
            referenciaTabela: "ferias_solicitacoes",
            referenciaId: solicitacao.id,
            requerAcao: true,
          });
        }

        return { data: solicitacao };
      });
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
      return rodaComoUsuario(request.user, async () => {
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
      });
    },
  );

  // Aprovação do gestor (1ª) ou do RH (2ª), conforme o estado atual.
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/aprovar",
    {
      onRequest: [app.authenticate, exigirPapeis("GESTOR", "COORDENADOR DP", "RH")],
      schema: { tags: ["Férias"], summary: "Gestor ou RH aprova sua etapa atual" },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
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
        const ehResponsavelLocal = info.responsavelPrimeiraEtapaId === request.user.id;
        if (
          (info.status !== "PENDENTE" && info.status !== "APROVADO_GESTOR") ||
          !podeDecidirEtapa(request.user.papelCodigo, info.status, ehResponsavelLocal)
        ) {
          return reply.code(403).send({ message: "Você não pode aprovar esta etapa da solicitação." });
        }
        // Chefia local só decide os pedidos sob sua responsabilidade; ADMIN passa.
        if (
          (request.user.papelCodigo === "GESTOR" || request.user.papelCodigo === "COORDENADOR DP") &&
          !ehResponsavelLocal
        ) {
          return reply
            .code(403)
            .send({ message: "Você não é responsável pela primeira etapa desta solicitação." });
        }

        const aprovacaoRh = info.status === "APROVADO_GESTOR";
        const dto = aprovacaoRh
          ? await aprovarRhSolicitacao(request.params.id, request.user.id)
          : await aprovarSolicitacao(request.params.id, request.user.id);
        if (!dto) {
          return reply
            .code(404)
            .send({ message: "Solicitação não encontrada ou já decidida." });
        }

        {
          const aguardaAssistente = dto.status === "AGUARDANDO_ASSISTENTE";
          // Encaminha ao confirmador correto (acionável) e avisa o colaborador.
          // Usa info.tipo (FERIAS ou FOLGA) — sem isso os dois textos ficam
          // sempre "férias" mesmo quando a solicitação original era folga, e o
          // card de "Atividades recentes" não dá pra saber do que se trata.
          const substantivo = info.tipo === "FOLGA" ? "folga" : "férias";
          await emitirParaPapeis(aguardaAssistente ? ["ASSISTENTE"] : ["RH"], {
            atorId: request.user.id,
            tipo: `${info.tipo}_${aguardaAssistente ? "AGUARDA_ASSISTENTE" : "AGUARDA_RH"}`,
            acao: `aprovou ${substantivo} de ${primeiroEUltimoNome(info.funcionarioNome)}`,
            detalhe: info.periodo,
            referenciaTabela: "ferias_solicitacoes",
            referenciaId: request.params.id,
            requerAcao: true,
          });
          await emitirParaUsuario(info.userId, {
            atorId: request.user.id,
            tipo: `${info.tipo}_${aprovacaoRh ? "APROVADA_RH" : "APROVADA_GESTOR"}`,
            acao: `aprovou sua solicitação de ${substantivo} (aguardando ${aguardaAssistente ? "Tesoureiro Assistente" : "Recursos Humanos"})`,
            detalhe: info.periodo,
            referenciaTabela: "ferias_solicitacoes",
            referenciaId: request.params.id,
          });
        }

        return { data: dto };
      });
    },
  );

  // 3ª etapa — Tesoureiro Assistente confirma (APROVADO_RH → APROVADO).
  app.patch<{
    Params: { id: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/confirmar",
    {
      onRequest: [app.authenticate, exigirPapeis("ASSISTENTE")],
      schema: { tags: ["Férias"], summary: "Tesoureiro Assistente confirma a solicitação (3ª etapa)" },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const info = await getSolicitacaoParaNotificar(request.params.id);
        if (!info) {
          return reply.code(404).send({ message: "Solicitação não encontrada." });
        }
        if (info.userId === request.user.id) {
          return reply
            .code(403)
            .send({ message: "Você não pode confirmar a sua própria solicitação." });
        }
        const dto = await confirmarSolicitacao(request.params.id, request.user.id);
        if (!dto) {
          return reply
            .code(404)
            .send({ message: "Solicitação não encontrada ou não está aguardando o Tesoureiro Assistente." });
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
          await enviarEmail({
            para: info.funcionarioEmail,
            assunto: "Suas férias foram confirmadas",
            texto: `Olá ${info.funcionarioNome},\n\nSuas férias foram confirmadas pelo Tesoureiro Assistente para o período ${info.periodo} (${info.dias} dia(s)).\n\nVeja os detalhes em ${getApiConfig().appUrl}/ferias.`,
            destaqueHtml: DESTAQUE_FERIAS_CONFIRMADAS_HTML,
          });
        }

        return { data: dto };
      });
    },
  );

  // 2ª etapa (alternativa à confirmação) — RH devolve uma sugestão de nova
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
      onRequest: [app.authenticate, exigirPapeis("RH")],
      schema: {
        tags: ["Férias"],
        summary: "RH sugere um novo início pro período, em vez de aprovar (2ª etapa)",
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
      return rodaComoUsuario(request.user, async () => {
        const info = await getSolicitacaoParaNotificar(request.params.id);
        if (!info) {
          return reply.code(404).send({ message: "Solicitação não encontrada." });
        }
        if (info.userId === request.user.id) {
          return reply
            .code(403)
            .send({ message: "Você não pode sugerir um ajuste na sua própria solicitação." });
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
            .send({ message: "Solicitação não encontrada ou não está aguardando o RH." });
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
      });
    },
  );

  // O colaborador aceita o ajuste sugerido pelo RH: aplica a nova data e
  // reinicia o fluxo (gestor aprova de novo, RH confirma de novo). Não há
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
        summary: "Colaborador aceita o ajuste de data sugerido pelo RH",
      },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
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
            tipo: `${solicitacao.tipo}_SOLICITADA`,
            acao: "aceitou o ajuste de data e aguarda aprovação",
            detalhe: solicitacao.periodo,
            referenciaTabela: "ferias_solicitacoes",
            referenciaId: solicitacao.id,
            requerAcao: true,
          });
        } else {
          const aguardaAssistente = statusInicial === "APROVADO_RH";
          await emitirParaPapeis(aguardaAssistente ? ["ASSISTENTE"] : ["RH"], {
            atorId: request.user.id,
            tipo: `${solicitacao.tipo}_${aguardaAssistente ? "AGUARDA_ASSISTENTE" : "AGUARDA_RH"}`,
            acao: "aceitou o ajuste de data e aguarda confirmação",
            detalhe: solicitacao.periodo,
            referenciaTabela: "ferias_solicitacoes",
            referenciaId: solicitacao.id,
            requerAcao: true,
          });
        }

        return { data: solicitacao };
      });
    },
  );

  // Recusar na etapa atual: gestor, RH ou Tesoureiro Assistente, com justificativa.
  app.patch<{
    Params: { id: string };
    Body: { motivo: string };
    Reply: ApiResponse<SolicitacaoFeriasDTO> | { message: string };
  }>(
    "/ferias/:id/recusar",
    {
      onRequest: [
        app.authenticate,
        exigirPapeis("GESTOR", "COORDENADOR DP", "RH", "ASSISTENTE"),
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
      return rodaComoUsuario(request.user, async () => {
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
        const ehResponsavelLocal = info.responsavelPrimeiraEtapaId === request.user.id;
        if (!ehEtapaDecisao(info.status) || !podeDecidirEtapa(papel, info.status, ehResponsavelLocal)) {
          return reply.code(403).send({ message: "Você não pode recusar esta etapa da solicitação." });
        }
        if (
          (papel === "GESTOR" || papel === "COORDENADOR DP") &&
          !ehResponsavelLocal
        ) {
          return reply.code(403).send({ message: "Você não é responsável pela primeira etapa desta solicitação." });
        }
        const motivo = request.body.motivo.trim();
        if (!motivo) {
          return reply.code(400).send({ message: "Informe o motivo da recusa." });
        }

        const dto = await recusarSolicitacao(
          request.params.id,
          request.user.id,
          motivo,
          info.status,
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
      });
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
      return rodaComoUsuario(request.user, async () => {
        const papel = request.user.papelCodigo;
        // RH/Tesoureiro Assistente/ADMIN podem cancelar após a confirmação.
        const ehConfirmador =
          papel === "ASSISTENTE" ||
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
            await emitirParaPapeis(["RH", "ASSISTENTE"], {
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
      });
    },
  );

  // Excluir: só o próprio dono, e só depois de CANCELADA (aba Pessoal —
  // limpar o histórico de algo que já foi cancelado). ADMIN pula as duas
  // travas — ver excluirSolicitacao em lib/ferias.ts.
  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/ferias/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["Férias"], summary: "Exclui uma solicitação já cancelada" },
    },
    async (request, reply) => {
      return rodaComoUsuario(request.user, async () => {
        const resultado = await excluirSolicitacao(
          request.params.id,
          request.user.id,
          request.user.papelCodigo === "ADMIN",
        );

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
      });
    },
  );

  /* ── Fluxo de aprovação (configuração de exceções, ADMIN) ──────────────
   * Tela "Fluxo de aprovação" (FluxoAprovacaoAdmin.tsx). A tabela
   * `fluxo_aprovadores` é module-agnostic (ver 037_fluxo_aprovadores.sql),
   * mas por enquanto só o módulo de Férias tem tela — por isso `modulo`
   * fica fixo aqui, sem expor um admin genérico multi-módulo que ninguém
   * pediu ainda. AVISO: esta configuração ainda não é lida pelo fluxo real
   * de decisão (feriasFluxo.ts) — é só armazenamento + tela por enquanto. */

  const MODULO_FLUXO_FERIAS = "FERIAS";

  app.get<{ Reply: ApiListResponse<FluxoAprovador> }>(
    "/ferias/fluxo-aprovadores",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: {
        tags: ["Férias — Fluxo de aprovação"],
        summary: "Lista as exceções configuradas ao fluxo padrão de aprovação de férias",
      },
    },
    async () => {
      const fluxo = await listFluxoAprovadores(MODULO_FLUXO_FERIAS);
      return { data: fluxo, total: fluxo.length };
    },
  );

  app.post<{
    Body: FluxoAprovadorInput;
    Reply: ApiResponse<FluxoAprovador> | { message: string };
  }>(
    "/ferias/fluxo-aprovadores",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: {
        tags: ["Férias — Fluxo de aprovação"],
        summary: "Cria uma exceção ao fluxo padrão de aprovação de férias",
        body: {
          type: "object",
          required: ["etapa"],
          properties: {
            etapa: { type: "string", minLength: 1 },
            grupo: { type: ["string", "null"] },
            userId: { type: ["string", "null"] },
            papelId: { type: ["string", "null"] },
            setorIds: { type: ["array", "null"], items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const fluxo = await criarFluxoAprovador(MODULO_FLUXO_FERIAS, request.body);
        return reply.code(201).send({ data: fluxo });
      } catch (error) {
        if (error instanceof FluxoAprovadorInvalidoError) {
          return reply.code(400).send({ message: error.message });
        }
        if ((error as { code?: string }).code === "23505") {
          return reply
            .code(409)
            .send({ message: "Já existe uma exceção cadastrada para esse escopo nessa etapa." });
        }
        throw error;
      }
    },
  );

  app.patch<{
    Params: { id: string };
    Body: FluxoAprovadorInput;
    Reply: ApiResponse<FluxoAprovador> | { message: string };
  }>(
    "/ferias/fluxo-aprovadores/:id",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: {
        tags: ["Férias — Fluxo de aprovação"],
        summary: "Atualiza uma exceção ao fluxo padrão de aprovação de férias",
        body: {
          type: "object",
          required: ["etapa"],
          properties: {
            etapa: { type: "string", minLength: 1 },
            grupo: { type: ["string", "null"] },
            userId: { type: ["string", "null"] },
            papelId: { type: ["string", "null"] },
            setorIds: { type: ["array", "null"], items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      try {
        const fluxo = await atualizarFluxoAprovador(request.params.id, request.body);
        if (!fluxo) {
          return reply.code(404).send({ message: "Exceção não encontrada." });
        }
        return { data: fluxo };
      } catch (error) {
        if (error instanceof FluxoAprovadorInvalidoError) {
          return reply.code(400).send({ message: error.message });
        }
        if ((error as { code?: string }).code === "23505") {
          return reply
            .code(409)
            .send({ message: "Já existe uma exceção cadastrada para esse escopo nessa etapa." });
        }
        throw error;
      }
    },
  );

  app.delete<{ Params: { id: string }; Reply: { message: string } | undefined }>(
    "/ferias/fluxo-aprovadores/:id",
    {
      onRequest: [app.authenticate, exigirPapeis()],
      schema: {
        tags: ["Férias — Fluxo de aprovação"],
        summary: "Exclui uma exceção ao fluxo padrão de aprovação de férias",
      },
    },
    async (request, reply) => {
      const excluido = await excluirFluxoAprovador(request.params.id);
      if (!excluido) {
        return reply.code(404).send({ message: "Exceção não encontrada." });
      }
      return reply.code(204).send(undefined);
    },
  );
}
