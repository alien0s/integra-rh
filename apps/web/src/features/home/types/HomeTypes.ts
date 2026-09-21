/**
 * Types do dashboard (Home). Eventos, férias e aniversariantes ainda são
 * estáticos (services/homeService.ts); comunicados já vêm da API real
 * (GET /comunicados/ativos).
 */

/** Um item do carrossel de eventos da empresa (foto + legenda). */
export interface EventoItem {
  id: string
  titulo: string
  descricao: string
  /** Data legível (ex.: "02/09/2026"). */
  data: string
  local?: string
  imagemUrl: string
}

/** Um item do carrossel "Comunicados e avisos" (sem foto — só texto). */
export interface ComunicadoItem {
  id: string
  titulo: string
  /** Data legível (ex.: "02/09/2026"). */
  data: string
  resumo: string
  anexoTipo: 'IMAGEM' | 'PDF' | null
}

/**
 * Status de férias do colaborador logado, pro card do dashboard.
 * `diasParaFerias` null = ainda não solicitou férias pro ciclo vigente
 * (mesma ideia da obrigação recorrente OBRIGACAO_FERIAS_SOLICITAR no
 * back — ver lib/obrigacoes.ts); preenchido = tem férias aprovadas chegando.
 */
export interface FeriasStatusMock {
  diasParaFerias: number | null
  /** Período legível (ex.: "10 – 30 de novembro"). Só faz sentido quando diasParaFerias != null. */
  periodo?: string
}

/** Um aniversariante do mês, pro card de aniversariantes. */
export interface Aniversariante {
  id: string
  nome: string
  /** Data legível (ex.: "15 de outubro"). */
  data: string
  fotoUrl: string
  iniciais: string
}

/** Payload completo do dashboard (o que services/homeService.ts devolve). */
export interface DashboardData {
  comunicados: ComunicadoItem[]
  ferias: FeriasStatusMock
  aniversariantes: Aniversariante[]
}