export interface VrMes {
  id: string
  /** Grupo (campo) dono do mês: ACeAm, ANRA... */
  grupo: string
  mes: number
  ano: number
  fechado: boolean
  valorDiario: number
  valorDiarioAprendiz: number
  diasElegiveis: number
}

export interface VrMesDetalhado extends VrMes {
  diasElegiveisDatas: string[]
}

export interface CriarVrMesInput {
  /** Só o ADMIN precisa informar; os demais sempre usam o grupo da própria entidade. */
  grupo?: string
  mes: number
  ano: number
  valorDiario: number
  valorDiarioAprendiz: number
  diasElegiveis: string[]
}

export interface EditarVrMesInput {
  valorDiario: number
  valorDiarioAprendiz: number
  diasElegiveis: string[]
}

/** Resultado do fechamento de 1 entidade dentro de 1 mês. */
export interface FechamentoVrResultado {
  vrMesId: string
  entityId: string
  entityNome: string
  registrosGerados: number
  lancamentosAplicados: number
  lancamentosPendentesProximoMes: number
  /** true quando essa foi a última entidade pendente — o mês inteiro fechou. */
  mesInteiroFechado: boolean
}

export type FormatoExportacaoVr = 'pdf' | 'txt' | 'xlsx'

export type TipoLancamentoVr = 'DESCONTO' | 'EXTRA'

export const MOTIVOS_LANCAMENTO_VR = [
  'Férias',
  'Casamento',
  'Afastamento',
  'Feriado',
  'Falta',
  'Atestado',
  'Trabalho Externo',
  'Treinamento',
  'Atestado de Óbito',
  'Viagem',
  'Outros',
] as const

export interface LancamentoVr {
  id: string
  userId: string
  userNome: string
  tipoLancamento: TipoLancamentoVr
  dataDesconto: string
  motivo: string | null
  descontoAplicado: boolean
  /** Nome de quem lançou (null em lançamentos anteriores à coluna existir). */
  criadoPorNome: string | null
}

export interface ItemLancamentoVr {
  userId: string
  tipoLancamento: TipoLancamentoVr
  dataDesconto: string
  motivo: string | null
}

export interface LancamentoVrDetalhado extends LancamentoVr {
  /** Grupo (campo) do mês do lançamento. */
  grupo: string
  mes: number
  ano: number
}

export interface PreVisualizacaoLinha {
  userId: string
  userNome: string
  userEmail: string
  diasVr: number
  qtdDesconto: number
  qtdExtra: number
  valorAReceber: number
}

export interface PreVisualizacaoResultado {
  itens: PreVisualizacaoLinha[]
  totalBruto: number
  totalDescontos: number
  totalExtras: number
  valorFinal: number
  colaboradores: number
}

/** Uma entidade (empresa/organização) simples, pra dropdowns/filtros. */
export interface EntidadeOpcao {
  id: string
  nome: string
  grupo: string | null
}

/** Um colaborador pro seletor de lançamentos, já com a entidade dele. */
export interface ColaboradorOpcao {
  id: string
  nome: string
  entityId: string
  /** Grupo (campo) da entidade do colaborador. */
  entityGrupo: string | null
}

/** Escopo da pessoa logada no VR: ADMIN vê todos os grupos; os demais, só o da própria entidade. */
export interface EscopoVr {
  admin: boolean
  grupo: string | null
  /** Grupos em que a pessoa pode cadastrar/ver mês. */
  grupos: string[]
}

/** Status de fechamento de 1 entidade dentro de 1 mês. */
export interface StatusFechamentoEntidade {
  entityId: string
  entityNome: string
  fechado: boolean
  fechadoEm: string | null
}