/** Types do módulo de Feriados (mapa que limita o calendário de férias). */

export type TipoFeriado = 'NACIONAL' | 'ESTADUAL' | 'MUNICIPAL' | 'FACULTATIVO'
export type FonteFeriado = 'MANUAL' | 'BRASILAPI' | 'APS'

export interface Feriado {
  id: string
  /** Data no formato YYYY-MM-DD. */
  data: string
  nome: string
  tipo: TipoFeriado
  ano: number
  fonte: FonteFeriado
}

/** Entrada para criar/atualizar um feriado. */
export interface FeriadoInput {
  data: string
  nome: string
  tipo: TipoFeriado
}
