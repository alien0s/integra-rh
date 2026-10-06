import { Award, BookOpen, GraduationCap, type LucideIcon } from 'lucide-react'

import type { NivelCEFR, NivelFormacao } from '@/features/cursos/types'

export interface CursoStyleConfig {
  icon: LucideIcon
  bgClass: string
  textClass: string
  barClass: string
  barEmptyClass: string
}

export const CURSOS_STYLES: Record<string, CursoStyleConfig> = {
  FORMADOS: {
    icon: GraduationCap,
    bgClass: 'bg-blue-100 dark:bg-blue-900/50',
    textClass: 'text-blue-600 dark:text-blue-400',
    barClass: 'bg-blue-500 dark:bg-blue-400',
    barEmptyClass: 'bg-blue-100 dark:bg-blue-900/40',
  },
  EM_FORMACAO: {
    icon: BookOpen,
    bgClass: 'bg-violet-100 dark:bg-violet-900/50',
    textClass: 'text-violet-600 dark:text-violet-400',
    barClass: 'bg-violet-500 dark:bg-violet-400',
    barEmptyClass: 'bg-violet-100 dark:bg-violet-900/40',
  },
  CURSOS_RAPIDOS: {
    icon: Award,
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/50',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    barClass: 'bg-emerald-500 dark:bg-emerald-400',
    barEmptyClass: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
}

/** Rótulo por extenso de cada nível de formação (usado como prefixo do curso). */
export const NIVEL_FORMACAO_LABEL: Record<NivelFormacao, string> = {
  TECNICO: 'Técnico em',
  GRADUACAO: 'Graduação em',
  POS_GRADUACAO: 'Pós-graduação em',
  MBA: 'MBA em',
  MESTRADO: 'Mestrado em',
  DOUTORADO: 'Doutorado em',
}

/** Monta o título exibido (ex.: "Graduação em Administração de Empresas"). */
export function formatarTituloFormacao(nivel: NivelFormacao, curso: string): string {
  return `${NIVEL_FORMACAO_LABEL[nivel]} ${curso}`
}

/** Rótulo em pt-BR de cada nível CEFR — fonte única é o código (A1-C2). */
export const NIVEL_CEFR_LABEL: Record<NivelCEFR, string> = {
  A1: 'Básico (A1)',
  A2: 'Básico (A2)',
  B1: 'Intermediário (B1)',
  B2: 'Intermediário (B2)',
  C1: 'Avançado (C1)',
  C2: 'Avançado (C2)',
}

/** % da barra de proficiência derivado do nível CEFR (A1=1/6 ... C2=6/6). */
export const NIVEL_CEFR_PROGRESSO: Record<NivelCEFR, number> = {
  A1: 17,
  A2: 33,
  B1: 50,
  B2: 67,
  C1: 83,
  C2: 100,
}
