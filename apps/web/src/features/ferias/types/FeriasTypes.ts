/**
 * Types locais do módulo de Férias.
 */

/** Situação de uma solicitação de férias. */
export type StatusSolicitacaoFerias = 'PENDENTE' | 'APROVADA' | 'REJEITADA'

/** Solicitação de férias de um colaborador. */
export interface SolicitacaoFerias {
  id: string
  /** Nome do colaborador solicitante. */
  funcionarioNome: string
  /** Matrícula/ID do colaborador. */
  matricula: string
  /** Data-aniversário do ciclo de férias / período aquisitivo (ex.: "7 de julho"). */
  cicloFerias: string
  /** Foto do colaborador (exibida em formato quadrado). */
  avatarUrl: string
  /** Iniciais usadas como fallback do avatar. */
  iniciais: string
  /** Quantidade de dias solicitados. */
  dias: number
  /** Data de início das férias em ISO (ex.: "2026-11-21"). */
  inicio: string
  /** Período legível (ex.: "21 – 28 de nov, 2026"). */
  periodo: string
  /** Data em que a solicitação foi feita (ex.: "10/06/2026"). */
  dataSolicitacao: string
  /** Saldo de dias restantes. */
  diasRestantes: number
  /** Saldo total de dias no período aquisitivo. */
  diasTotais: number
  status: StatusSolicitacaoFerias
  /** Justificativa informada ao rejeitar a solicitação. */
  motivoRejeicao?: string
}
