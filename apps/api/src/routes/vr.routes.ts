import type { FastifyInstance, FastifyRequest } from "fastify";

import {
  buscarRegistrosParaExportacao,
  gerarRelatorioTodosLancamentosPdf,
  gerarRelatorioVrCsv,
  gerarRelatorioVrExcel,
  gerarRelatorioVrPdf,
} from "../lib/vr.export.js";
import {
  AcessoMesVrNegadoError,
  buscarVrMesDetalhado,
  cancelarLancamento,
  criarLancamentosEmLote,
  criarVrMes,
  editarVrMes,
  EntidadeFechadaNaoAceitaLancamentoError,
  EntidadeForaDoGrupoError,
  EntidadeJaFechadaError,
  EntidadeNaoParticipaVrError,
  fecharVrPorEntidade,
  garantirAcessoAoLancamento,
  garantirAcessoAoMes,
  GrupoVrInvalidoError,
  grupoDoEscopo,
  LancamentoForaDoGrupoError,
  LancamentoJaAplicadoError,
  listarColaboradoresParaSelecao,
  listarEntidades,
  listarGruposVr,
  listarLancamentosDoMes,
  listarStatusFechamentoPorEntidade,
  listarTodosLancamentos,
  listarVrMeses,
  preVisualizarFechamento,
  resolverEscopoVr,
  SemGrupoVrError,
  VrMesJaExisteError,
  VrMesAbertoExistenteError,
  VrMesJaFechadoError,
  VrMesNaoEncontradoError,
  VrMesSemDiasElegiveisError,
  type CriarLancamentoInput,
  type CriarVrMesInput,
  type EditarVrMesInput,
  type EntidadeOpcao,
  type EscopoVr,
  type FechamentoVrResultado,
  type LancamentoVr,
  type LancamentoVrDetalhado,
  type PreVisualizacaoResultado,
  type StatusFechamentoEntidade,
  type VrMesDetalhado,
  type VrMesResumo,
} from "../lib/vr.service.js";
import { rodaComoUsuario } from "../lib/database.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

/**
 * Quem pode tocar no VR (qualquer rota): MESMO conjunto das policies de RLS das
 * tabelas do VR (migration 010) — o banco só libera as linhas pra esses papéis
 * (`app.papel`). Se mudar aqui, mude lá também.
 */
const PAPEIS_LIBERADOS_VR = new Set(["ADMIN", "DP", "COORDENADOR DP", "ASSISTENTE", "TESOUREIRO"]);

function podeGerenciarVr(user: { papelCodigo?: string | null }): boolean {
  return Boolean(user.papelCodigo && PAPEIS_LIBERADOS_VR.has(user.papelCodigo));
}

const FORMATOS_EXPORTACAO = ["pdf", "csv", "xlsx"] as const;
type FormatoExportacao = (typeof FORMATOS_EXPORTACAO)[number];

/**
 * Rotas de Vale-Refeição (VR). O fechamento é POR ENTIDADE (ACeAm, RADOAM,
 * NT Store...): cada uma fecha e exporta seus arquivos de forma
 * independente das outras — ver POST /vr/:vrMesId/entidades/:entityId/fechar.
 * Restrito aos papéis de PAPEIS_LIBERADOS_VR (alinhado com as policies de RLS).
 */
export async function vrRoutes(app: FastifyInstance) {
  /* ── Escopo por grupo (campo) ────────────────────────────────────────── */
  // Cada grupo (ACeAm, ANRA...) tem o seu mês de VR. ADMIN enxerga todos; os
  // demais, só o grupo da PRÓPRIA entidade. Esse hook roda em TODA rota do
  // VR (depois do authenticate): resolve o escopo da pessoa e, se a rota tem
  // :vrMesId, barra mês de outro grupo antes de o handler executar.
  const escoposPorRequisicao = new WeakMap<object, EscopoVr>();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function escopoDe(request: FastifyRequest): EscopoVr {
    return escoposPorRequisicao.get(request) ?? { admin: false, grupo: null };
  }

  app.addHook("preHandler", async (request, reply) => {
    if (!podeGerenciarVr(request.user)) {
      return reply.code(403).send({ message: "Sem permissão para acessar o Vale-Refeição." });
    }

    // vr_mes tem RLS forçado: as consultas de escopo precisam da identidade.
    return rodaComoUsuario(request.user, async () => {
      const escopo = await resolverEscopoVr(request.user);
      escoposPorRequisicao.set(request, escopo);

      const vrMesId = (request.params as { vrMesId?: string } | undefined)?.vrMesId;
      if (!vrMesId) return;
      if (!UUID.test(vrMesId)) {
        return reply.code(404).send({ message: "Mês de VR não encontrado." });
      }
      try {
        await garantirAcessoAoMes(vrMesId, escopo);
      } catch (error) {
        if (error instanceof VrMesNaoEncontradoError) {
          return reply.code(404).send({ message: "Mês de VR não encontrado." });
        }
        if (error instanceof AcessoMesVrNegadoError || error instanceof SemGrupoVrError) {
          return reply.code(403).send({ message: error.message });
        }
        throw error;
      }
    });
  });

  // Escopo da pessoa logada (grupo + grupos disponíveis) — o front usa pra
  // decidir se mostra o seletor de grupo no cadastro de mês (só ADMIN).
  app.get<{ Reply: ApiResponse<{ admin: boolean; grupo: string | null; grupos: string[] }> }>(
    "/vr/escopo",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Escopo (grupo) da pessoa logada no VR" },
    },
    async (request) =>
      rodaComoUsuario(request.user, async () => {
      const escopo = escopoDe(request);
      const grupos = await listarGruposVr(grupoDoEscopo(escopo));
      return { data: { admin: escopo.admin, grupo: escopo.grupo, grupos } };
      }),
  );

  /* ── Leitura ─────────────────────────────────────────────────────────── */

  // Lista TODOS os lançamentos (todos os meses) — visão geral aplicado/pendente.
  app.get<{ Reply: ApiListResponse<LancamentoVrDetalhado> | { message: string } }>(
    "/vr/lancamentos",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Lista todos os lançamentos de VR (todos os meses)" },
    },
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver os lançamentos de VR." });
      }
      const lancamentos = await listarTodosLancamentos(grupoDoEscopo(escopoDe(request)));
      return { data: lancamentos, total: lancamentos.length };
      }),
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
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para exportar os lançamentos de VR." });
      }

      const { busca, mes, ano, tipo, status } = request.query;
      const todos = await listarTodosLancamentos(grupoDoEscopo(escopoDe(request)));

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
      }),
  );

  // Lista todas as entidades cadastradas (id/nome) — pra dropdowns/filtros.
  app.get<{ Reply: ApiListResponse<EntidadeOpcao> | { message: string } }>(
    "/vr/entidades",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Lista as entidades cadastradas" },
    },
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver as entidades do VR." });
      }
      const entidades = await listarEntidades(grupoDoEscopo(escopoDe(request)));
      return { data: entidades, total: entidades.length };
      }),
  );

  // Lista colaboradores (só id/nome) pra popular o seletor de lançamentos.
  // ?entityId=... restringe a 1 entidade.
  app.get<{
    Querystring: { entityId?: string };
    Reply:
      | ApiListResponse<{ id: string; nome: string; entityId: string; entityGrupo: string | null }>
      | { message: string };
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
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver os colaboradores do VR." });
      }
      const colaboradores = await listarColaboradoresParaSelecao(
        request.query.entityId,
        grupoDoEscopo(escopoDe(request)),
      );
      return { data: colaboradores, total: colaboradores.length };
      }),
  );

  // Lista todos os meses cadastrados (mais recentes primeiro).
  app.get<{ Reply: ApiListResponse<VrMesResumo> }>(
    "/vr",
    {
      onRequest: [app.authenticate],
      schema: { tags: ["VR"], summary: "Lista os meses de Vale-Refeição cadastrados" },
    },
    async (request) =>
      rodaComoUsuario(request.user, async () => {
      const meses = await listarVrMeses(grupoDoEscopo(escopoDe(request)));
      return { data: meses, total: meses.length };
      }),
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
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver o detalhe do mês de VR." });
      }
      const detalhe = await buscarVrMesDetalhado(request.params.vrMesId);
      if (!detalhe) {
        return reply.code(404).send({ message: "Mês de VR não encontrado." });
      }
      return { data: detalhe };
      }),
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
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para ver o status das entidades." });
      }
      const status = await listarStatusFechamentoPorEntidade(request.params.vrMesId);
      return { data: status, total: status.length };
      }),
  );

  /* ── Escrita ─────────────────────────────────────────────────────────── */

  // Cadastra um novo mês (valores diários + dias elegíveis marcados no calendário).
  app.post<{
    Body: Omit<CriarVrMesInput, "grupo"> & { grupo?: string };
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
            grupo: { type: "string" },
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
        const escopo = escopoDe(request);
        let grupo: string;
        if (escopo.admin) {
          if (!request.body.grupo) {
            return reply.code(400).send({ message: "Informe o grupo do mês." });
          }
          grupo = request.body.grupo;
        } else {
          if (!escopo.grupo) {
            return reply.code(403).send({ message: new SemGrupoVrError().message });
          }
          grupo = escopo.grupo; // não-admin só cria mês do próprio grupo
        }
        const criado = await criarVrMes({ ...request.body, grupo }, request.user);
        return reply.code(201).send({ data: criado });
      } catch (error) {
        if (error instanceof GrupoVrInvalidoError) {
          return reply.code(400).send({ message: error.message });
        }
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
        const atualizado = await editarVrMes(request.params.vrMesId, request.body, request.user);
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
    async (request) =>
      rodaComoUsuario(request.user, async () => {
      const lancamentos = await listarLancamentosDoMes(
        request.params.vrMesId,
        request.query.entityId,
      );
      return { data: lancamentos, total: lancamentos.length };
      }),
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
          request.user,
        );
        return { data: criados, total: criados.length };
      } catch (error) {
        if (error instanceof LancamentoForaDoGrupoError) {
          return reply.code(400).send({ message: error.message });
        }
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
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
      if (!podeGerenciarVr(request.user)) {
        return reply.code(403).send({ message: "Sem permissão para cancelar lançamentos de VR." });
      }

      try {
        await garantirAcessoAoLancamento(request.params.id, escopoDe(request));
        await cancelarLancamento(request.params.id);
        return reply.code(204).send(undefined);
      } catch (error) {
        if (error instanceof AcessoMesVrNegadoError) {
          return reply.code(403).send({ message: error.message });
        }
        if (error instanceof LancamentoJaAplicadoError) {
          return reply.code(409).send({ message: error.message });
        }
        throw error;
      }
      }),
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
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
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
      }),
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
          request.user,
        );
        return { data: resultado };
      } catch (error) {
        if (error instanceof VrMesNaoEncontradoError) {
          return reply.code(404).send({ message: error.message });
        }
        if (error instanceof EntidadeForaDoGrupoError) {
          return reply.code(400).send({ message: error.message });
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
    async (request, reply) =>
      rodaComoUsuario(request.user, async () => {
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
      }),
  );
}
