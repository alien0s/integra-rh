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

/* ── Aba "Pessoal" (autosserviço do colaborador) ── */

/** Resumo do saldo de férias do colaborador. */
export interface FeriasResumo {
  diasDisponiveis: number
  diasAgendados: number
  /** Período aquisitivo legível (ex.: "15 Jun 2024 - 14 Jun 2025"). */
  periodoAquisitivo: string
}

/** Situação de uma solicitação no histórico do colaborador. */
export type StatusMinhaSolicitacao = 'APROVADO' | 'PENDENTE' | 'RECUSADO'

/** Item do histórico de solicitações do próprio colaborador. */
export interface MinhaSolicitacao {
  id: string
  /** Período legível (ex.: "15 Dez 2023 - 29 Dez 2023"). */
  periodo: string
  /** Detalhe de dias (ex.: "15 dias corridos", "10 dias (Abono incluso)"). */
  detalhe: string
  /** Tipo (ex.: "Férias Regulares", "Férias + Abono"). */
  tipo: string
  status: StatusMinhaSolicitacao
}
