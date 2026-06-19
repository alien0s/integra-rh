import type { CriarFuncionarioInput, Funcionario } from "@erp/shared-types";
import type { FastifyInstance } from "fastify";

import { criarFuncionario, listarFuncionarios } from "../data/funcionarios.js";
import type { ApiListResponse, ApiResponse } from "../types/api.js";

export async function funcionariosRoutes(app: FastifyInstance) {
  app.get<{ Reply: ApiListResponse<Funcionario> }>("/funcionarios", async () => {
    const funcionarios = listarFuncionarios();

    return {
      data: funcionarios,
      total: funcionarios.length
    };
  });

  app.post<{
    Body: CriarFuncionarioInput;
    Reply: ApiResponse<Funcionario>;
  }>(
    "/funcionarios",
    {
      schema: {
        body: {
          type: "object",
          required: [
            "nome",
            "cpf",
            "email",
            "cargo",
            "departamento",
            "salarioBase",
            "vinculo"
          ],
          properties: {
            nome: { type: "string", minLength: 3 },
            cpf: { type: "string", minLength: 11 },
            email: { type: "string", format: "email" },
            cargo: { type: "string", minLength: 2 },
            departamento: { type: "string", minLength: 2 },
            salarioBase: { type: "number", minimum: 0 },
            vinculo: { type: "string", enum: ["CLT", "PJ", "ESTAGIO"] }
          },
          additionalProperties: false
        }
      }
    },
    async (request, reply) => {
      const funcionario = criarFuncionario(request.body);

      return reply.code(201).send({
        data: funcionario
      });
    }
  );
}
