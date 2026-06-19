import {
  funcionarioExemplo,
  type CriarFuncionarioInput,
  type Funcionario
} from "@erp/shared-types";
import { formatarMatricula } from "@erp/rh-core";
import { randomUUID } from "node:crypto";

const funcionarios: Funcionario[] = [
  funcionarioExemplo,
  {
    id: "func-002",
    matricula: "ACEAM-0002",
    nome: "Bruno Lima",
    cpf: "111.111.111-11",
    email: "bruno.lima@example.com",
    cargo: "Coordenador Financeiro",
    departamento: "Financeiro",
    salarioBase: 6800,
    dataAdmissao: "2023-08-01",
    status: "ATIVO",
    vinculo: "CLT"
  }
];

export function listarFuncionarios() {
  return funcionarios;
}

export function buscarFuncionarioPorId(id: string) {
  return funcionarios.find((funcionario) => funcionario.id === id);
}

export function criarFuncionario(input: CriarFuncionarioInput) {
  const funcionario: Funcionario = {
    id: randomUUID(),
    matricula: formatarMatricula(funcionarios.length + 1),
    nome: input.nome,
    cpf: input.cpf,
    email: input.email,
    cargo: input.cargo,
    departamento: input.departamento,
    salarioBase: input.salarioBase,
    dataAdmissao: new Date().toISOString().slice(0, 10),
    status: "ATIVO",
    vinculo: input.vinculo
  };

  funcionarios.push(funcionario);

  return funcionario;
}
