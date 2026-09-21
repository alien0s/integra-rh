import type { FastifyInstance } from "fastify";

import {
  buscarRegistrosParaExportacao,
  gerarRelatorioTodosLancamentosPdf,
  gerarRelatorioVrCsv,
  gerarRelatorioVrExcel,
  gerarRelatorioVrPdf,
} from "../lib/vr.export.js";
import {
  buscarVrMesDetalhado,
  cancelarLancamento,
  criarLancamentosEmLote,
  criarVrMes,
  editarVrMes,
  EntidadeFechadaNaoAceitaLancamentoError,
  EntidadeJaFechadaError,
  EntidadeNaoParticipaVrError,
  fecharVrPorEntidade,
  LancamentoJaAplicadoError,
  listarColaboradoresParaSelecao,
  listarEntidades,
  listarLancamentosDoMes,
  listarStatusFechamentoPorEntidade,
  listarTodosLancamentos,
  listarVrMeses,
  preVisualizarFechamento,
  VrMesJaExisteError,
  VrMesAbertoExistenteError,
  VrMesJaFechadoError,
  VrMesNaoEncontradoError,
  VrMesSemDiasElegiveisError,
  type CriarLancamentoInput,
  type CriarVrMesInput,
  type EditarVrMesInput,
  type EntidadeOpcao,
  type FechamentoVrResultado,
  type LancamentoVr,
  type LancamentoVrDetalhado,
  type PreVisualizacaoResultado,
  type StatusFechamentoEntidade,
  type VrMesDetalhado,
  type VrMesResumo,
} from "../lib/vr.service.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/**
 * Quem pode gerenciar o VR (cadastrar mês, lançar, fechar, exportar):
 *   - ADMIN (acesso total)
 *   - Qualquer pessoa do setor Inovação
 *   - Qualquer pessoa do setor Departamento Pessoal
 *   - Papel Tesoureiro, Tesoureiro Assistente ou Coord. Departamento Pessoal
 *     (independente do setor da pessoa)
 */
const SETOR_INOVACAO = "Inovação";
const SETOR_GESTAO_DE_PESSOAS = "Departamento Pessoal";
const PAPEIS_QUEM_PODEM_GERENCIAR_VR = new Set(["TESOUREIRO", "ASSISTENTE", "COORDENADOR_DP"]);

function podeGerenciarVr(user: {
  papelCodigo?: string | null;
  setor?: string | null;
}): boolean {
  if (user.papelCodigo === "ADMIN") return true;
  if (user.setor === SETOR_INOVACAO) return true;
  if (user.setor === SETOR_GESTAO_DE_PESSOAS) return true;
  if (user.papelCodigo && PAPEIS_QUEM_PODEM_GERENCIAR_VR.has(user.papelCodigo)) return true;
  return false;
}

const FORMATOS_EXPORTACAO = ["pdf", "csv", "xlsx"] as const;
type FormatoExportacao = (typeof FORMATOS_EXPORTACAO)[number];

/**
 * Rotas de Vale-Refeição (VR). O fechamento é POR ENTIDADE (ACeAm, RADOAM,
 * NT Store...): cada uma fecha e exporta seus arquivos de forma
 * independente das outras — ver POST /vr/:vrMesId/entidades/:entityId/fechar.
 * Restrito a ADMIN / setor Inovação / setor Departamento Pessoal.
 */
export async function vrRoutes(app: FastifyInstance) {
  /* ── Leitura ─────────────────────────────────────────────────────────── */

  // Lista TODOS os lançamentos (todos os meses) — visão geral aplicado/pendente.
  app.get<{ Reply: ApiListResponse<LancamentoVrDetalhado> | { message: string } }>(
    "/vr/lancamentos",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Lista todos os lançamentos de VR (todos os meses)" },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver os lançamentos de VR." });
      }
      const lancamentos = await listarTodosLancamentos();
      return { data: lancamentos, total: lancamentos.length };
    },
  );

  // Baixa em PDF os lançamentos filtrados exatamente como a tela "Todos os
  // lançamentos" está mostrando no momento (mesmos filtros aplicados no front).
  app.get<{
    Querystring: { busca?: string; mes?: string; ano?: string; tipo?: string; status?: string };
  }>(
    "/vr/lancamentos/exportar/pdf",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Baixa em PDF os lançamentos filtrados (nome/mês/tipo/status)",
        querystring: {
          type: "object",
          properties: {
            busca: { type: "string" },
            mes: { type: "string" },
            ano: { type: "string" },
            tipo: { type: "string", enum: ["DESCONTO", "EXTRA"] },
            status: { type: "string", enum: ["APLICADO", "PENDENTE"] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para exportar os lançamentos de VR." });
      }

      const { busca, mes, ano, tipo, status } = request.query;
      const todos = await listarTodosLancamentos();

      const filtrados = todos.filter((l) => {
        if (busca && !l.userNome.toLowerCase().includes(busca.toLowerCase())) return false;
        if (mes && ano && (l.mes !== Number(mes) || l.ano !== Number(ano))) return false;
        if (tipo && l.tipoLancamento !== tipo) return false;
        if (status === "APLICADO" && !l.descontoAplicado) return false;
        if (status === "PENDENTE" && l.descontoAplicado) return false;
        return true;
      });

      const pdf = await gerarRelatorioTodosLancamentosPdf(filtrados, request.user.nome);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", 'attachment; filename="vr-lancamentos.pdf"')
        .send(pdf);
    },
  );

  // Lista todas as entidades cadastradas (id/nome) — pra dropdowns/filtros.
  app.get<{ Reply: ApiListResponse<EntidadeOpcao> | { message: string } }>(
    "/vr/entidades",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Lista as entidades cadastradas" },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver as entidades do VR." });
      }
      const entidades = await listarEntidades();
      return { data: entidades, total: entidades.length };
    },
  );

  // Lista colaboradores (só id/nome) pra popular o seletor de lançamentos.
  // ?entityId=... restringe a 1 entidade.
  app.get<{
    Querystring: { entityId?: string };
    Reply: ApiListResponse<{ id: string; nome: string; entityId: string }> | { message: string };
  }>(
    "/vr/colaboradores",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Lista colaboradores ativos (id/nome) para o seletor de lançamentos",
        querystring: {
          type: "object",
          properties: { entityId: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver os colaboradores do VR." });
      }
      const colaboradores = await listarColaboradoresParaSelecao(request.query.entityId);
      return { data: colaboradores, total: colaboradores.length };
    },
  );

  // Lista todos os meses cadastrados (mais recentes primeiro).
  app.get<{ Reply: ApiListResponse<VrMesResumo> }>(
    "/vr",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Lista os meses de Vale-Refeição cadastrados" },
    },
    async () => {
      const meses = await listarVrMeses();
      return { data: meses, total: meses.length };
    },
  );

  // Detalhe completo de um mês (com as datas dos dias elegíveis) — usado
  // pra pré-popular o formulário de edição.
  app.get<{
    Params: { vrMesId: string };
    Reply: ApiResponse<VrMesDetalhado> | { message: string };
  }>(
    "/vr/:vrMesId",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Detalhe de um mês de VR (com os dias elegíveis)" },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver o detalhe do mês de VR." });
      }
      const detalhe = await buscarVrMesDetalhado(request.params.vrMesId);
      if (!detalhe) {
        return reply.code(404).send({ message: "Mês de VR não encontrado." });
      }
      return { data: detalhe };
    },
  );

  // Status de fechamento (aberta/fechada) de cada entidade, dentro de 1 mês.
  app.get<{
    Params: { vrMesId: string };
    Reply: ApiListResponse<StatusFechamentoEntidade> | { message: string };
  }>(
    "/vr/:vrMesId/entidades-status",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Status de fechamento de cada entidade, dentro de 1 mês" },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver o status das entidades." });
      }
      const status = await listarStatusFechamentoPorEntidade(request.params.vrMesId);
      return { data: status, total: status.length };
    },
  );

  /* ── Escrita ─────────────────────────────────────────────────────────── */

  // Cadastra um novo mês (valores diários + dias elegíveis marcados no calendário).
  app.post<{
    Body: CriarVrMesInput;
    Reply: ApiResponse<VrMesResumo> | { message: string };
  }>(
    "/vr",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Cadastra um novo mês de VR (valores diários + dias elegíveis)",
        body: {
          type: "object",
          required: ["mes", "ano", "valorDiario", "valorDiarioAprendiz", "diasElegiveis"],
          properties: {
            mes: { type: "integer", minimum: 1, maximum: 12 },
            ano: { type: "integer", minimum: 2000 },
            valorDiario: { type: "number", minimum: 0 },
            valorDiarioAprendiz: { type: "number", minimum: 0 },
            diasElegiveis: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para cadastrar o mês de VR." });
      }

      try {
        const criado = await criarVrMes(request.body);
        return reply.code(201).send({ data: criado });
      } catch (error) {
        if (error instanceof VrMesJaExisteError) {
          return reply.code(409).send({ message: error.message });
        }
        if (error instanceof VrMesAbertoExistenteError) {
          return reply.code(409).send({ message: error.message });
        }
        if (error instanceof VrMesSemDiasElegiveisError) {
          return reply.code(400).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Edita um mês já cadastrado (valores + dias elegíveis) — só enquanto
  // NENHUMA entidade tiver fechado esse mês ainda.
  app.patch<{
    Params: { vrMesId: string };
    Body: EditarVrMesInput;
    Reply: ApiResponse<VrMesResumo> | { message: string };
  }>(
    "/vr/:vrMesId",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Edita um mês de VR — só enquanto nenhuma entidade tiver fechado",
        body: {
          type: "object",
          required: ["valorDiario", "valorDiarioAprendiz", "diasElegiveis"],
          properties: {
            valorDiario: { type: "number", minimum: 0 },
            valorDiarioAprendiz: { type: "number", minimum: 0 },
            diasElegiveis: { type: "array", items: { type: "string" } },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para editar o mês de VR." });
      }

      try {
        const atualizado = await editarVrMes(request.params.vrMesId, request.body);
        return { data: atualizado };
      } catch (error) {
        if (error instanceof VrMesNaoEncontradoError) {
          return reply.code(404).send({ message: error.message });
        }
        if (error instanceof VrMesJaFechadoError) {
          return reply.code(409).send({ message: error.message });
        }
        if (error instanceof VrMesSemDiasElegiveisError) {
          return reply.code(400).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Lista os lançamentos (desconto/extra) de um mês. ?entityId=... restringe a 1 entidade.
  app.get<{
    Params: { vrMesId: string };
    Querystring: { entityId?: string };
    Reply: ApiListResponse<LancamentoVr>;
  }>(
    "/vr/:vrMesId/lancamentos",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Lista os lançamentos de desconto/extra de um mês",
        querystring: {
          type: "object",
          properties: { entityId: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (request) => {
      const lancamentos = await listarLancamentosDoMes(
        request.params.vrMesId,
        request.query.entityId,
      );
      return { data: lancamentos, total: lancamentos.length };
    },
  );

  // Lança vários descontos/extras de uma vez (individual multi-data OU desconto em massa).
  // Rejeita se algum colaborador for de uma entidade que já fechou este mês.
  app.post<{
    Params: { vrMesId: string };
    Body: { itens: Array<Omit<CriarLancamentoInput, "vrMesId">> };
    Reply: ApiListResponse<LancamentoVr> | { message: string };
  }>(
    "/vr/:vrMesId/lancamentos/lote",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Lança vários descontos/extras de uma vez (individual ou em massa)",
        body: {
          type: "object",
          required: ["itens"],
          properties: {
            itens: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["userId", "tipoLancamento", "dataDesconto"],
                properties: {
                  userId: { type: "string", minLength: 1 },
                  tipoLancamento: { type: "string", enum: ["DESCONTO", "EXTRA"] },
                  dataDesconto: { type: "string" },
                  motivo: { type: ["string", "null"] },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para lançar desconto/extra de VR." });
      }

      const itensNormalizados = request.body.itens.map((item) => ({
        ...item,
        motivo: item.motivo ?? null,
      }));

      try {
        const criados = await criarLancamentosEmLote(
          request.params.vrMesId,
          itensNormalizados,
          request.user.id,
        );
        return { data: criados, total: criados.length };
      } catch (error) {
        if (error instanceof EntidadeFechadaNaoAceitaLancamentoError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Cancela (apaga) um lançamento ainda não aplicado.
  app.delete<{
    Params: { id: string };
    Reply: { message: string } | undefined;
  }>(
    "/vr/lancamentos/:id",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Cancela um lançamento de VR ainda não aplicado" },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para cancelar lançamentos de VR." });
      }

      try {
        await cancelarLancamento(request.params.id);
        return reply.code(204).send(undefined);
      } catch (error) {
        if (error instanceof LancamentoJaAplicadoError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Pré-visualização do fechamento (dry-run, não grava nada). ?entityId=... restringe a 1 entidade.
  app.get<{
    Params: { vrMesId: string };
    Querystring: { entityId?: string };
    Reply: ApiResponse<PreVisualizacaoResultado> | { message: string };
  }>(
    "/vr/:vrMesId/pre-visualizar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Simula o que o fechamento geraria (sem gravar nada) para conferir antes de fechar",
        querystring: {
          type: "object",
          properties: { entityId: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver a pré-visualização do VR." });
      }

      try {
        const resultado = await preVisualizarFechamento(
          request.params.vrMesId,
          request.query.entityId,
        );
        return { data: resultado };
      } catch (error) {
        if (error instanceof VrMesNaoEncontradoError) {
          return reply.code(404).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Fecha o VR de UMA entidade dentro de um mês (FIFO). Independente das outras.
  app.post<{
    Params: { vrMesId: string; entityId: string };
    Reply: ApiResponse<FechamentoVrResultado> | { message: string };
  }>(
    "/vr/:vrMesId/entidades/:entityId/fechar",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Fecha o VR de 1 entidade dentro de 1 mês (aplica os lançamentos em FIFO)",
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para fechar o VR." });
      }

      try {
        const resultado = await fecharVrPorEntidade(
          request.params.vrMesId,
          request.params.entityId,
        );
        return { data: resultado };
      } catch (error) {
        if (error instanceof VrMesNaoEncontradoError) {
          return reply.code(404).send({ message: error.message });
        }
        if (error instanceof EntidadeJaFechadaError) {
          return reply.code(409).send({ message: error.message });
        }
        if (error instanceof EntidadeNaoParticipaVrError) {
          return reply.code(400).send({ message: error.message });
        }
        throw error;
      }
    },
  );

  // Download do relatório (pdf/csv/xlsx) de um mês. ?entityId=... restringe a 1 entidade
  // (só traz quem já foi fechado — vr_registro só existe pra quem fechou).
  app.get<{
    Params: { vrMesId: string; formato: FormatoExportacao };
    Querystring: { entityId?: string };
  }>(
    "/vr/:vrMesId/exportar/:formato",
    {
      onRequest: [app.authenticate],
      schema: {
        tags: ["VR"],
        summary: "Baixa o relatório de VR (pdf, csv ou xlsx), opcionalmente filtrado por entidade",
        params: {
          type: "object",
          required: ["vrMesId", "formato"],
          properties: {
            vrMesId: { type: "string" },
            formato: { type: "string", enum: [...FORMATOS_EXPORTACAO] },
          },
        },
        querystring: {
          type: "object",
          properties: { entityId: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para exportar o VR." });
      }

      const { vrMesId, formato } = request.params;
      const { entityId } = request.query;

      const detalhe = await buscarVrMesDetalhado(vrMesId);
      if (!detalhe) {
        return reply.code(404).send({ message: "Mês de VR não encontrado." });
      }

      const registros = await buscarRegistrosParaExportacao(vrMesId, entityId);
      const nomeBase = `vr-${String(detalhe.mes).padStart(2, "0")}-${detalhe.ano}`;

      if (formato === "csv") {
        const csv = gerarRelatorioVrCsv(registros);
        return reply
          .header("Content-Type", "text/csv; charset=utf-8")
          .header("Content-Disposition", `attachment; filename="${nomeBase}.csv"`)
          .send(csv);
      }

      if (formato === "xlsx") {
        const excel = gerarRelatorioVrExcel(registros);
        return reply
          .header(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          )
          .header("Content-Disposition", `attachment; filename="${nomeBase}.xlsx"`)
          .send(excel);
      }

      const pdf = await gerarRelatorioVrPdf(registros, request.user.nome);
      return reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="${nomeBase}.pdf"`)
        .send(pdf);
    },
  );
}
