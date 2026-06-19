import { calcularFolha } from "@erp/rh-core";
import type { Folha, HoleriteItem } from "@erp/shared-types";
import type { FastifyInstance } from "fastify";

import { buscarFuncionarioPorId, listarFuncionarios } from "../data/funcionarios.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

interface CalcularFolhaBody {
  funcionarioId: string;
  competencia: string;
  adicional?: number;
  desconto?: number;
}

export async function folhasRoutes(app: FastifyInstance) {
  app.get<{
    Params: { competencia: string };
    Reply: ApiListResponse<Folha>;
  }>("/folhas/:competencia", async (request) => {
    const data = listarFuncionarios()
      .filter((funcionario) => funcionario.status === "ATIVO")
      .map((funcionario) =>
        calcularFolha(funcionario, {
          competencia: request.params.competencia
        })
      );

    return {
      data,
      total: data.length
    };
  });

  app.post<{
    Body: CalcularFolhaBody;
    Reply: ApiResponse<Folha> | { message: string };
  }>(
    "/folhas/calcular",
    {
      schema: {
        body: {
          type: "object",
          required: ["funcionarioId", "competencia"],
          properties: {
            funcionarioId: { type: "string", minLength: 1 },
            competencia: { type: "string", pattern: "^\\d{4}-\\d{2}$" },
            adicional: { type: "number", minimum: 0 },
            desconto: { type: "number", minimum: 0 }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      const funcionario = buscarFuncionarioPorId(request.body.funcionarioId);

      if (!funcionario) {
        return reply.code(404).send({ message: "Funcionário não encontrado" });
      }

      const adicionais = criarItensOpcionais(
        "050",
        "Adicional informado",
        "PROVENTO",
        request.body.adicional
      );
      const descontos = criarItensOpcionais(
        "150",
        "Desconto informado",
        "DESCONTO",
        request.body.desconto
      );
      const folha = calcularFolha(funcionario, {
        competencia: request.body.competencia,
        adicionais,
        descontos
      });

      return {
        data: folha
      };
    }
  );
}

function criarItensOpcionais(
  codigo: string,
  descricao: string,
  tipo: HoleriteItem["tipo"],
  valor?: number
) {
  if (!valor) {
    return [];
  }

  return [
    {
      codigo,
      descricao,
      tipo,
      valor
    }
  ];
}
