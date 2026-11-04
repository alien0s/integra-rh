/**
 * Types do módulo de Cursos e Qualificações — espelham os DTOs da API
 * (`GET /qualificacoes/*`). `status`/`motivoRecusa` só existem nas variantes
 * "própria" (autosserviço) — a visão pública (perfil de outra pessoa) nunca
 * expõe o fluxo de aprovação do RH.
 */

export type StatusQualificacao = 'PENDENTE' | 'APROVADO' | 'RECUSADO'

/**
 * Nome da tabela de origem de uma qualificação — mesmo valor usado em
 * `notificacoes.referencia_tabela` no backend. Usado pra saber qual tipo de
 * registro (e qual layout) mostrar no DetalheQualificacaoDialog.
 */
export type TabelaQualificacao =
  | 'qualificacoes_academicas'
  | 'qualificacoes_cursos'
  | 'qualificacoes_idiomas'

/* ── Formação acadêmica ── */

export type NivelFormacao =
  | 'TECNICO'
  | 'GRADUACAO'
  | 'POS_GRADUACAO'
  | 'MBA'
  | 'MESTRADO'
  | 'DOUTORADO'
export type SituacaoFormacao = 'EM_ANDAMENTO' | 'CONCLUIDO' | 'TRANCADO'

export interface FormacaoAcademica {
  id: string
  nivel: NivelFormacao
  curso: string
  instituicao: string
  anoInicio: number
  anoFim: number | null
  situacao: SituacaoFormacao
  anexoUrl: string | null
  status?: StatusQualificacao
  motivoRecusa?: string | null
}

export interface NovaFormacaoInput {
  nivel: NivelFormacao
  curso: string
  instituicao: string
  anoInicio: number
  anoFim: number | null
  situacao: SituacaoFormacao
  anexoUrl: string | null
}

/** Igual a NovaFormacaoInput, menos `anexoUrl` (o anexo tem endpoint próprio). */
export type EditarFormacaoInput = Omit<NovaFormacaoInput, 'anexoUrl'>

/* ── Cursos, workshops e certificações (tabela mesclada — `tipo` diferencia) ── */

export type TipoCursoQualificacao = 'CERTIFICACAO' | 'CURSO' | 'WORKSHOP'

export interface CursoQualificacao {
  id: string
  tipo: TipoCursoQualificacao
  nome: string
  instituicao: string
  cargaHoraria: number | null
  dataEmissao: string | null
  dataValidade: string | null
  certificadoUrl: string | null
  status?: StatusQualificacao
  motivoRecusa?: string | null
}

export interface NovoCursoInput {
  tipo: TipoCursoQualificacao
  nome: string
  instituicao: string
  cargaHoraria: number | null
  dataEmissao: string | null
  dataValidade: string | null
  certificadoUrl: string | null
}

/* ── Idiomas ── */

export type NivelCEFR = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type OrigemAvaliacaoIdioma = 'AUTODECLARADO' | 'TESTE_INTERNO'

export interface Idioma {
  id: string
  idioma: string
  nivelCefr: NivelCEFR
  origemAvaliacao: OrigemAvaliacaoIdioma
  avaliadoEm: string | null
  status?: StatusQualificacao
  motivoRecusa?: string | null
}

export interface NovoIdiomaInput {
  idioma: string
  nivelCefr: NivelCEFR
}

/* ── Visão geral (dashboard) ── */

export interface StatsCardData {
  /** Quantidade de pessoas nessa categoria */
  count: number
  /** Total geral de colaboradores ativos */
  total: number
}

export interface QualificacoesResumo {
  formados: StatsCardData
  emFormacao: StatsCardData
  cursosRapidos: StatsCardData
}

export interface FuncionarioQualificacoes {
  id: string
  nome: string
  cargo: string
  departamento: string
  fotoUrl: string
  iniciais: string
  qtdFormacoes: number
  qtdCursosWorkshops: number
  qtdCertificacoes: number
  total: number
}

/** Qualificações aprovadas de um colaborador (visão pública de perfil). */
export interface QualificacoesDeUsuario {
  formacoes: FormacaoAcademica[]
  cursos: CursoQualificacao[]
  idiomas: Idioma[]
}

/* ── Fila de moderação (RH/DP/Admin) — QualificacoesPendentesDialog ── */

/** Campos extras que só existem na fila de moderação (quem mandou e quando). */
interface ItemModeracao {
  funcionarioNome: string
  fotoUrl: string
  iniciais: string
  /** ISO (`new Date(...)` direto) — a lista ordena pelo mais antigo primeiro. */
  createdAt: string
}

export type FormacaoAcademicaModeracao = FormacaoAcademica & ItemModeracao
export type CursoQualificacaoModeracao = CursoQualificacao & ItemModeracao
export type IdiomaModeracao = Idioma & ItemModeracao

/** Resposta de GET /qualificacoes/pendentes — tudo que está PENDENTE agora. */
export interface QualificacoesPendentes {
  formacoes: FormacaoAcademicaModeracao[]
  cursos: CursoQualificacaoModeracao[]
  idiomas: IdiomaModeracao[]
}
