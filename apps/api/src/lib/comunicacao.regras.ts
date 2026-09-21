import type { StatusComunicado, DiaSemana } from "../types/comunicacao.js";

// Único papel que fica de fora — todo o resto (Coordenador pra cima) pode solicitar
const PAPEL_SEM_ACESSO = "COLABORADOR";

// RH e ADMIN têm o mesmo poder no módulo de Comunicação (publicar direto,
// aprovar, rejeitar, remover).
const PAPEIS_COM_PODER_RH = new Set(["RH", "ADMIN"]);

export function podeCriarComunicado(papelCodigo: string): boolean {
  return papelCodigo !== PAPEL_SEM_ACESSO;
}

export function podeAprovarOuRejeitar(papelCodigo: string): boolean {
  return PAPEIS_COM_PODER_RH.has(papelCodigo);
}

export function podeRemover(papelCodigo: string): boolean {
  return PAPEIS_COM_PODER_RH.has(papelCodigo);
}

// Define o status com que o comunicado nasce, de acordo com quem está criando.
// RH e ADMIN publicam direto. Qualquer outro papel (mesmo Presidente) precisa
// de aprovação.
export function statusInicial(papelCodigo: string): StatusComunicado {
  return PAPEIS_COM_PODER_RH.has(papelCodigo) ? "PUBLICADO" : "AGUARDANDO_APROVACAO";
}

// Recorrente não tem período (fica no ar todo dia_semana, indefinidamente).
// Não-recorrente precisa das duas datas, com fim >= início.
export function validarPeriodo(
  recorrente: boolean,
  dataInicio?: string,
  dataFim?: string
): void {
  if (recorrente) return;

  if (!dataInicio || !dataFim) {
    throw new Error("Comunicado não recorrente precisa de data de início e fim");
  }

  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new Error("Data de início ou fim inválida");
  }

  if (fim < inicio) {
    throw new Error("A data de fim não pode ser anterior à data de início");
  }
}

export function validarRecorrencia(recorrente: boolean, diaSemana?: DiaSemana): void {
  if (recorrente && diaSemana === undefined) {
    throw new Error("Comunicado recorrente precisa informar o dia da semana");
  }

  if (!recorrente && diaSemana !== undefined) {
    throw new Error("Dia da semana só deve ser informado para comunicados recorrentes");
  }
}