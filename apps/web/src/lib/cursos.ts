import { Award, BookOpen, GraduationCap, type LucideIcon } from 'lucide-react'

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
