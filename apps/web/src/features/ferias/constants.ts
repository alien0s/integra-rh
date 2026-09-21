import type { TipoFeriado } from '@/features/ferias/types'

/**
 * Tipos de feriado com o rótulo legível exibido na UI (select do editor e
 * tooltip do calendário). Fonte única para não duplicar a lista entre os
 * componentes `FeriadosAdmin` e `FeriadoDiaDialog`.
 */
export const TIPOS_FERIADO: { value: TipoFeriado; label: string }[] = [
  { value: 'NACIONAL', label: 'Nacional' },
  { value: 'ESTADUAL', label: 'Estadual' },
  { value: 'MUNICIPAL', label: 'Municipal' },
  { value: 'FACULTATIVO', label: 'Facultativo' },
]

/** Rótulo legível de um tipo de feriado (fallback para o próprio código). */
export function rotuloTipoFeriado(tipo: TipoFeriado): string {
  return TIPOS_FERIADO.find((t) => t.value === tipo)?.label ?? tipo
}
