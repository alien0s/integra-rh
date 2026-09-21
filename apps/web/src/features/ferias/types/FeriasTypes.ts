/**
 * Types locais do módulo de Férias.
 */

/**
 * Situação de uma solicitação de férias (fluxo de 2 etapas):
 *   PENDENTE         → aguardando o gestor do setor.
 *   AGUARDANDO_DP    → gestor aprovou; aguardando o DP confirmar.
 *   AJUSTE_SUGERIDO  → DP devolveu uma sugestão de nova data; aguardando o
 *                      colaborador aceitar.
 *   APROVADA         → DP confirmou (final).
 *   REJEITADA        → recusada pelo gestor ou DP.
 *   CANCELADA        → cancelada (colaborador antes de confirmar, ou DP depois).
 */
export type StatusSolicitacaoFerias =
  | 'PENDENTE'
  | 'AGUARDANDO_DP'
  | 'AJUSTE_SUGERIDO'
  | 'APROVADA'
  | 'REJEITADA'
  | 'CANCELADA'

/**
 * Origem de uma solicitação: SOLICITACAO = pedido normal do colaborador
 * (passa pelo fluxo de aprovação); REGISTRO_MANUAL = lançado pelo RH/Admin
 * (férias/folga que já aconteceram fora do sistema — histórico/retroativo),
 * já nasce aprovado.
 */
export type OrigemFerias = 'SOLICITACAO' | 'REGISTRO_MANUAL'

/** Solicitação de férias de um colaborador. */
export interface SolicitacaoFerias {
  id: string
  /** ID do colaborador solicitante (para saber se é do próprio usuário logado). */
  userId: string
  /** Papel do solicitante — define quem confirma (COORDENADOR DP ou RH). */
  solicitantePapel?: string
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
  /** Dias vendidos (abono) nesse pedido, 0-10 — exige a exceção liberada pelo DP. */
  diasVendidos: number
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
  origem: OrigemFerias
  /** Progresso da aprovação — quem aprovou/confirmou/cancelou e quando. */
  aprovadoGestorNome?: string
  aprovadoGestorEm?: string
  aprovadoDpNome?: string
  decididoEm?: string
  canceladoNome?: string
  canceladoEm?: string
  motivoCancelamento?: string
  /** Ajuste sugerido pelo DP (status AJUSTE_SUGERIDO) — período proposto + motivo. */
  periodoSugerido?: string
  ajusteSugeridoPorNome?: string
  ajusteSugeridoEm?: string
  motivoAjuste?: string
}

/** Visão geral do DP/RH: quem vai entrar de férias e quem precisa tirar. */
export interface VisaoGeralFerias {
  vaoEntrar: SolicitacaoFerias[]
  precisamTirar: ColaboradorPendenteFerias[]
}

/** Colaborador com ciclo aquisitivo perto de fechar e sem pedido. */
export interface ColaboradorPendenteFerias {
  userId: string
  nome: string
  avatarUrl: string
  iniciais: string
  setor: string | null
  cicloFim: string
  diasParaFimDoCiclo: number
}

/* ── Aba "Pessoal" (autosserviço do colaborador) ── */

/** Resumo do saldo de férias do colaborador. */
export interface FeriasResumo {
  diasDisponiveis: number
  diasAgendados: number
  /** Período aquisitivo legível (ex.: "15 Jun 2024 - 14 Jun 2025"). */
  periodoAquisitivo: string
  /** Exceções liberadas pelo DP pra esse colaborador (aba "Exceções"). */
  podeFracionarFerias: boolean
  podeVenderFerias: boolean
}

/** Um colaborador no diálogo "Exceções" (DP) — nome/foto/setor + as duas flags. */
export interface ExcecaoFeriasUsuario {
  id: string
  nome: string
  setor: string
  avatarUrl: string
  iniciais: string
  podeFracionarFerias: boolean
  podeVenderFerias: boolean
}

/** Situação de uma solicitação no histórico do colaborador (status "cru" do banco). */
export type StatusMinhaSolicitacao =
  | 'PENDENTE'
  | 'APROVADO_GESTOR'
  | 'AJUSTE_SUGERIDO'
  | 'APROVADO'
  | 'RECUSADO'
  | 'CANCELADO'

/** Item do histórico de solicitações do próprio colaborador. */
export interface MinhaSolicitacao {
  id: string
  /** Período legível (ex.: "15 Dez 2023 - 29 Dez 2023"). */
  periodo: string
  /** Detalhe de dias (ex.: "15 dias corridos"). */
  detalhe: string
  /** Tipo (ex.: "Férias Regulares", "Folga"). */
  tipo: string
  /** Tipo "cru" (FERIAS/FOLGA), pra checagens sem parsear o rótulo `tipo`. */
  tipoBase: 'FERIAS' | 'FOLGA'
  status: StatusMinhaSolicitacao
  origem: OrigemFerias
  /** Dias vendidos (abono) nesse pedido, 0-10 — exige a exceção liberada pelo DP. */
  diasVendidos: number
  /** Motivo, quando RECUSADO. */
  motivoRejeicao?: string
  /** Ajuste sugerido pelo DP (status AJUSTE_SUGERIDO) — período proposto + motivo. */
  periodoSugerido?: string
  motivoAjuste?: string
}
