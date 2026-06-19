import type { Folha, Funcionario, HoleriteItem } from "@erp/shared-types";

export interface CalcularFolhaOptions {
  competencia: string;
  adicionais?: HoleriteItem[];
  descontos?: HoleriteItem[];
}

export function formatarMatricula(numero: number) {
  return `ACEAM-${numero.toString().padStart(4, "0")}`;
}

export function normalizarCompetencia(competencia: string) {
  if (!/^\d{4}-\d{2}$/.test(competencia)) {
    throw new Error("Competência deve estar no formato YYYY-MM");
  }

  return competencia;
}

export function calcularFolha(
  funcionario: Funcionario,
  options: CalcularFolhaOptions
): Folha {
  const competencia = normalizarCompetencia(options.competencia);
  const proventos: HoleriteItem[] = [
    {
      codigo: "001",
      descricao: "Salário base",
      tipo: "PROVENTO",
      valor: funcionario.salarioBase
    },
    ...(options.adicionais ?? [])
  ];
  const descontoInss = Math.min(funcionario.salarioBase * 0.11, 908.85);
  const descontos: HoleriteItem[] = [
    {
      codigo: "101",
      descricao: "INSS estimado",
      tipo: "DESCONTO",
      valor: arredondarMoeda(descontoInss)
    },
    ...(options.descontos ?? [])
  ];
  const totalProventos = somarItens(proventos);
  const totalDescontos = somarItens(descontos);

  return {
    id: `folha-${competencia}-${funcionario.id}`,
    funcionarioId: funcionario.id,
    competencia,
    salarioBase: funcionario.salarioBase,
    proventos,
    descontos,
    salarioLiquido: arredondarMoeda(totalProventos - totalDescontos),
    status: "ABERTA",
    geradaEm: new Date().toISOString()
  };
}

export function calcularResumoFolha(
  funcionarios: Funcionario[],
  competencia: string
) {
  const folhas = funcionarios
    .filter((funcionario) => funcionario.status === "ATIVO")
    .map((funcionario) => calcularFolha(funcionario, { competencia }));
  const totalBruto = folhas.reduce((total, folha) => total + folha.salarioBase, 0);
  const totalLiquido = folhas.reduce(
    (total, folha) => total + folha.salarioLiquido,
    0
  );

  return {
    competencia,
    quantidade: folhas.length,
    totalBruto: arredondarMoeda(totalBruto),
    totalLiquido: arredondarMoeda(totalLiquido),
    totalLiquidoFormatado: formatarMoeda(totalLiquido)
  };
}

export function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(valor);
}

function somarItens(itens: HoleriteItem[]) {
  return itens.reduce((total, item) => total + item.valor, 0);
}

function arredondarMoeda(valor: number) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
