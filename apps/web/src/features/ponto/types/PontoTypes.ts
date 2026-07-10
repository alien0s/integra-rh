/**
 * Types locais do módulo de Ponto (registro de jornada).
 */

/** Situação de uma marcação (define a cor da célula). */
export type StatusMarcacao = 'ok' | 'alerta' | 'erro' | 'vazio'

/** Uma marcação de horário (entrada, intervalo, saída...). */
export interface Marcacao {
  /** Horário exibido (ex.: "07:50") ou vazio. */
  valor: string
  status: StatusMarcacao
}

/** Funcionário dono do registro de ponto. */
export interface FuncionarioPonto {
  nome: string
  fotoUrl: string
  iniciais: string
}

/** Registro de ponto de um dia. */
export interface RegistroPonto {
  id: string
  /** Funcionário do registro (coluna com foto + nome). */
  funcionario: FuncionarioPonto
  /** Dia da semana abreviado (ex.: "SEG"). */
  diaSemana: string
  /** Data (ex.: "01/05"). */
  data: string
  /** Jornada/escala do dia (ex.: "Escritório 08h às 18h"). */
  jornada: string
  entrada: Marcacao
  intervalo: Marcacao
  fimIntervalo: Marcacao
  saida: Marcacao
  /** Total trabalhado (ex.: "08:10") ou "—". */
  trabalhado: string
  /** Fim de semana: linha desabilitada/apagada (não selecionável). */
  fimDeSemana?: boolean
}
