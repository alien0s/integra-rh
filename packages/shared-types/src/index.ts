export type StatusFuncionario = "ATIVO" | "AFASTADO" | "DESLIGADO";

export type VinculoFuncionario = "CLT" | "PJ" | "ESTAGIO";

export interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  email: string;
  cargo: string;
  departamento: string;
  salarioBase: number;
  dataAdmissao: string;
  status: StatusFuncionario;
  vinculo: VinculoFuncionario;
}

export interface CriarFuncionarioInput {
  nome: string;
  cpf: string;
  email: string;
  cargo: string;
  departamento: string;
  salarioBase: number;
  vinculo: VinculoFuncionario;
}

export type StatusFolha = "ABERTA" | "FECHADA" | "PAGA";

export interface HoleriteItem {
  codigo: string;
  descricao: string;
  tipo: "PROVENTO" | "DESCONTO";
  valor: number;
}

export interface Folha {
  id: string;
  funcionarioId: string;
  competencia: string;
  salarioBase: number;
  proventos: HoleriteItem[];
  descontos: HoleriteItem[];
  salarioLiquido: number;
  status: StatusFolha;
  geradaEm: string;
}

export const funcionarioExemplo: Funcionario = {
  id: "func-001",
  matricula: "ACEAM-0001",
  nome: "Ana Carolina Souza",
  cpf: "000.000.000-00",
  email: "ana.souza@example.com",
  cargo: "Analista de RH",
  departamento: "Recursos Humanos",
  salarioBase: 5200,
  dataAdmissao: "2024-02-15",
  status: "ATIVO",
  vinculo: "CLT"
};

export const folhaExemplo: Folha = {
  id: "folha-2026-05-func-001",
  funcionarioId: "func-001",
  competencia: "2026-05",
  salarioBase: 5200,
  proventos: [
    {
      codigo: "001",
      descricao: "Salário base",
      tipo: "PROVENTO",
      valor: 5200
    }
  ],
  descontos: [
    {
      codigo: "101",
      descricao: "INSS estimado",
      tipo: "DESCONTO",
      valor: 572
    }
  ],
  salarioLiquido: 4628,
  status: "ABERTA",
  geradaEm: "2026-05-14T00:00:00.000Z"
};
