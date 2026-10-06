/** Ícone exibido no cartão de ação embutido. */
export type NotificacaoCartaoIcone = 'arquivo' | 'documento' | 'curso' | 'obrigacao' | 'folga'

/**
 * Notificação padrão do sistema lembrando de solicitar férias (obrigação
 * recorrente, sem ator) — avatar com Palmtree em vez de "?". Notificações de
 * EVENTO de férias (alguém solicitou/aprovou/etc., tipo "FERIAS_...") têm um
 * ator de verdade e continuam mostrando a foto da pessoa.
 */
export function ehNotificacaoDeFerias(tipo?: string): boolean {
  return Boolean(tipo && tipo.startsWith('OBRIGACAO_FERIAS'))
}

/**
 * Pra onde navegar ao clicar numa notificação de obrigação recorrente (por
 * `tipo` — ver lib/obrigacoes.ts no backend, que sempre usa o prefixo
 * "OBRIGACAO_"). Adicione uma entrada aqui ao registrar uma nova obrigação
 * lá; sem entrada, a notificação simplesmente não é clicável.
 */
export const ROTA_POR_TIPO_OBRIGACAO: Record<string, string> = {
  OBRIGACAO_FERIAS_SOLICITAR: '/ferias',
}

/**
 * Cartão de ação embutido numa notificação (ex.: um pedido de acesso a um
 * recurso). Renderiza ícone + título + subtítulo e, opcionalmente, os botões
 * Recusar / Aprovar.
 */
export interface NotificacaoCartao {
  /** Título do recurso (ex.: "Ease Design System.fig"). */
  titulo: string
  /** Subtítulo/metadado (ex.: "Editado há 12 min"). */
  subtitulo: string
  /** Ícone exibido à esquerda. */
  icone?: NotificacaoCartaoIcone
}

/** Uma notificação exibida no drawer do header. */
export interface Notificacao {
  id: string
  /** Quem gerou a notificação. */
  nome: string
  /** Ação realizada (ex.: "aprovou seu certificado"). */
  acao: string
  /** Detalhe complementar (ex.: nome do curso). */
  detalhe: string
  /** Tempo relativo exibido (ex.: "2 min", "Ontem"). */
  tempo: string
  /** URL do avatar de quem gerou a notificação. */
  avatar: string
  /** Iniciais para o fallback do avatar. */
  iniciais: string
  /** Se ainda não foi lida (destaca com bolinha azul). */
  lida: boolean
  /** Cartão de ação embutido (recurso relacionado). Opcional. */
  cartao?: NotificacaoCartao
  /** Quando true, exibe os botões Recusar / Aprovar no cartão. */
  requerAcao?: boolean
  /** Tipo do evento (ex.: "FERIAS_SOLICITADA"). */
  tipo?: string
  /** Recurso de origem — para o card acionar (ex.: aprovar a férias). */
  referenciaTabela?: string | null
  referenciaId?: string | null
  /** Tem um arquivo (diploma/certificado) pra ver antes de decidir. */
  temArquivo?: boolean
}
