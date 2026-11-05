// apps/api/src/types/presencaCulto.ts
// Tipos e constantes do módulo Presença no Culto (migration 038)

// -----------------------------------------------------------------------------
// Status do registro
// -----------------------------------------------------------------------------
export const STATUS_PRESENCA = {
  PRESENTE: 'Presente',
  FALTA: 'Falta',
  ATRASO: 'Atraso',
  JUSTIFICADO: 'Justificado',
  EM_APROVACAO: 'Em Aprovação',
} as const

export type StatusPresenca = (typeof STATUS_PRESENCA)[keyof typeof STATUS_PRESENCA]

// Status que podem vir da carga / ajuste manual (os outros nascem do fluxo)
export const STATUS_ORIGEM = [
  STATUS_PRESENCA.PRESENTE,
  STATUS_PRESENCA.FALTA,
  STATUS_PRESENCA.ATRASO,
]

// Decisão de líder e de aprovador final
export const DECISAO = {
  APROVADA: 'Aprovada',
  NEGADA: 'Negada',
} as const

export type Decisao = (typeof DECISAO)[keyof typeof DECISAO]

// -----------------------------------------------------------------------------
// Tipos de justificativa
// -----------------------------------------------------------------------------
export const TIPOS_JUSTIFICATIVA = [
  'Folga Autorizada',
  'Atestado',
  'Viagens a Trabalho',
  'Férias',
  'Treinamentos',
  'Atividades Interna/Externa',
  'Outros',
] as const

export type TipoJustificativa = (typeof TIPOS_JUSTIFICATIVA)[number]

// Atestado e Outros: o dia continua elegível e a pontuação vai pra 0.
// Todos os outros: dia neutro (descontar_no_ranking = true).
export const TIPOS_QUE_MANTEM_O_DIA: TipoJustificativa[] = ['Atestado', 'Outros']

export function tipoDescontaNoRanking(tipo: string) {
  return !TIPOS_QUE_MANTEM_O_DIA.includes(tipo as TipoJustificativa)
}

// Pontuação depois da justificativa aprovada / negada
export const PONTUACAO_JUSTIFICADA = 0
export const PONTUACAO_FALTA = -1

// -----------------------------------------------------------------------------
// Pontuação por horário de chegada (comparação por HH:MM)
// -----------------------------------------------------------------------------
export const FAIXAS_PONTUACAO = [
  { ate: '07:30', pontos: 3 },
  { ate: '07:35', pontos: 2 },
  { ate: '07:40', pontos: 1 },
]
export const PONTOS_APOS_ULTIMA_FAIXA = 0
export const PONTOS_MAXIMOS_POR_DIA = 3
export const HORARIO_PONTUAL = '07:30' // usado no desempate

// -----------------------------------------------------------------------------
// Categorias (aproveitamento em %)
// -----------------------------------------------------------------------------
export const CATEGORIAS = [
  { nome: 'Diamante', minimo: 95 },
  { nome: 'Ouro', minimo: 90 },
  { nome: 'Prata', minimo: 85 },
  { nome: 'Participante', minimo: 0 },
]

// -----------------------------------------------------------------------------
// Papéis (roles.codigo) no fluxo de aprovação
// -----------------------------------------------------------------------------
export const PAPEL = {
  COLABORADOR: 'COLABORADOR',
  PRESIDENTE: 'PRESIDENTE',
  TESOUREIRO: 'TESOUREIRO',
  ASSISTENTE: 'ASSISTENTE', // Tesoureiro Assistente
  COORDENADOR: 'COORDENADOR',
  GESTOR: 'GESTOR', // Departamental / Gerente
  ADMIN: 'ADMIN',
  DP: 'DP',
  RH: 'RH',
  COORDENADOR_DP: 'COORDENADOR DP',
} as const

// Passam pela etapa de líder antes do veredito final
export const PAPEIS_COM_ETAPA_LIDER = [
  PAPEL.COLABORADOR,
  PAPEL.ADMIN,
  PAPEL.DP,
  PAPEL.RH,
  PAPEL.COORDENADOR,
  PAPEL.COORDENADOR_DP,
]

// Vão direto pro aprovador final
export const PAPEIS_DIRETO_FINAL = [
  PAPEL.GESTOR,
  PAPEL.PRESIDENTE,
  PAPEL.TESOUREIRO,
  PAPEL.ASSISTENTE,
]

// Veem todas as justificativas e filas (sem poder agir nas que não são deles)
export const PAPEIS_VISAO_GERAL = [PAPEL.RH, PAPEL.ADMIN, PAPEL.TESOUREIRO]

// Gerenciam calendário, períodos, superiores de setor e ajustes manuais
export const PAPEIS_GESTAO_MODULO = [PAPEL.RH, PAPEL.ADMIN]

// -----------------------------------------------------------------------------
// Etapa em que a justificativa está (calculada, não fica no banco)
// -----------------------------------------------------------------------------
export const ETAPA = {
  AGUARDANDO_LIDER: 'AGUARDANDO_LIDER',
  AGUARDANDO_FINAL: 'AGUARDANDO_FINAL',
  CONCLUIDA: 'CONCLUIDA',
  SEM_JUSTIFICATIVA: 'SEM_JUSTIFICATIVA',
} as const

export type Etapa = (typeof ETAPA)[keyof typeof ETAPA]

// -----------------------------------------------------------------------------
// Ações do histórico
// -----------------------------------------------------------------------------
export const ACAO_HISTORICO = {
  JUSTIFICOU: 'JUSTIFICOU',
  LIDER_APROVOU: 'LIDER_APROVOU',
  LIDER_NEGOU: 'LIDER_NEGOU',
  LIDER_DEVOLVEU: 'LIDER_DEVOLVEU',
  FINAL_APROVOU: 'FINAL_APROVOU',
  FINAL_NEGOU: 'FINAL_NEGOU',
  AJUSTE_MANUAL: 'AJUSTE_MANUAL',
} as const

export type AcaoHistorico = (typeof ACAO_HISTORICO)[keyof typeof ACAO_HISTORICO]

// -----------------------------------------------------------------------------
// Anexo
// -----------------------------------------------------------------------------
export const ANEXO_MIMES_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]
export const ANEXO_TAMANHO_MAXIMO = 5 * 1024 * 1024 // 5 MB (mesmo limite do multipart no app.ts)
export const ANEXO_PASTA_MINIO = 'presenca-culto'

// -----------------------------------------------------------------------------
// Linhas do banco
// -----------------------------------------------------------------------------
export interface PresencaCulto {
  id: string
  codigo_aps_entidade: string // VARCHAR (migration 039)
  user_id: string | null
  nome: string | null
  data: string // DATE -> vem como ISO, renderizar com timeZone UTC
  hora: string | null // 'HH:MM:SS'
  status: StatusPresenca
  pontuacao: number
  status_original: StatusPresenca
  pontuacao_original: number
  ajustado_manualmente: boolean

  tipo_justificativa: TipoJustificativa | null
  justificativa_texto: string | null
  justificado_por: string | null
  justificado_em: string | null

  anexo_path: string | null
  anexo_nome: string | null
  anexo_mime: string | null

  lider_id: string | null
  status_lider: Decisao | null
  comentario_lider: string | null
  lider_em: string | null

  final_aprovador_id: string | null
  status_final: Decisao | null
  comentario_final: string | null
  final_em: string | null

  segunda_chance: boolean
  descontar_no_ranking: boolean

  criado_em: string
  atualizado_em: string
}

export interface CalendarioCulto {
  id: string
  data: string
  observacao: string | null
  criado_por: string | null
  criado_em: string
}

export interface PeriodoPremiacao {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  data_premiacao: string | null
  recurso_inicio: string | null
  recurso_fim: string | null
  fechado: boolean
  criado_por: string | null
  criado_em: string
}

export interface SetorSuperior {
  setor_id: string
  superior_id: string
  atualizado_por: string | null
  atualizado_em: string
}

export interface EntidadeAssistente {
  entity_id: string
  assistente_id: string
  atualizado_por: string | null
  atualizado_em: string
}

export interface HistoricoPresenca {
  id: string
  presenca_id: string
  acao: AcaoHistorico
  usuario_id: string | null
  comentario: string | null
  dados: any
  criado_em: string
}

// -----------------------------------------------------------------------------
// Entradas das rotas
// -----------------------------------------------------------------------------

// Colaborador justificando a própria falta (anexo vem no multipart)
export interface JustificarInput {
  tipo_justificativa: TipoJustificativa
  justificativa_texto: string
}

// Líder justificando por um funcionário, várias datas de uma vez
export interface JustificarEmLoteInput {
  presenca_ids: string[]
  tipo_justificativa: TipoJustificativa
  justificativa_texto: string
}

// Decisão do líder: devolver só se ainda não usou a segunda chance
export interface DecisaoLiderInput {
  acao: 'APROVAR' | 'NEGAR' | 'DEVOLVER'
  comentario?: string // obrigatório pra NEGAR e DEVOLVER
}

// Decisão final
export interface DecisaoFinalInput {
  acao: 'APROVAR' | 'NEGAR'
  comentario?: string // obrigatório pra NEGAR
}

// Ajuste manual do RH (câmera não pegou etc.)
export interface AjusteManualInput {
  status?: 'Presente' | 'Falta' | 'Atraso'
  hora?: string | null // 'HH:MM'
  pontuacao?: number // se não vier e vier hora, a lib calcula pelas faixas
  comentario: string // obrigatório: fica no histórico
}

// -----------------------------------------------------------------------------
// Saídas calculadas
// -----------------------------------------------------------------------------
export interface ResumoPresenca {
  user_id: string
  data_inicio: string
  data_fim: string
  pontos: number
  maximo: number // dias_elegiveis * 3
  dias_calendario: number
  dias_descontados: number
  dias_elegiveis: number
  aproveitamento: number // 0–100, 2 casas
  pontuais: number // chegadas até 07:30
  presentes: number
  atrasos: number
  faltas: number // sem justificativa aprovada
  em_aprovacao: number
  justificados: number
  maior_sequencia_pontual: number
  categoria: string
}

export interface ItemRanking extends ResumoPresenca {
  posicao: number
  nome: string
  email: string
  setor_id: string | null
  setor_nome: string | null
  foto_url: string | null
}