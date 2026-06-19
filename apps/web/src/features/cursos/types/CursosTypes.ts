export interface FormacaoAcademica {
  id: string
  curso: string
  instituicao: string
  periodo: string
  status: 'CONCLUÍDO' | 'EM ANDAMENTO'
  verificado?: boolean
}

export interface Idioma {
  id: string
  idioma: string
  nivel: string
  progresso: number
}

export interface Certificacao {
  id: string
  nome: string
  emissor: string
  validade: string
  icone: 'shield' | 'cloud' | string
}

export interface CursoWorkshop {
  id: string
  nome: string
  escola: string
  cargaHoraria: string
  ano: string
  linkCertificado?: string
}

export interface FuncionarioCursoSuperior {
  id: string
  nome: string
  cargo: string
  departamento: string
  fotoUrl: string
  iniciais: string
  cursosSuperiores: string[]
  emAndamento: string[]
  cursosRapidos: string[]
}

export interface StatsCardData {
  /** Quantidade de pessoas nessa categoria */
  count: number
  /** Total geral de colaboradores */
  total: number
  /** Variação em relação ao período anterior (ex: +2.8) */
  trend: number
}

export interface CursosStatsData {
  formados: StatsCardData
  emFormacao: StatsCardData
  cursosRapidos: StatsCardData
}

export interface CursosData {
  stats: CursosStatsData
  formacoes: FormacaoAcademica[]
  idiomas: Idioma[]
  certificacoes: Certificacao[]
  cursos: CursoWorkshop[]
  funcionariosCursosSuperiores: FuncionarioCursoSuperior[]
}
