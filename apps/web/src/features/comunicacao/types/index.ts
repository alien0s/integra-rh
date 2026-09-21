export type StatusComunicado =
  | 'RASCUNHO'
  | 'AGUARDANDO_APROVACAO'
  | 'APROVADO'
  | 'REJEITADO'
  | 'PUBLICADO'
  | 'ENCERRADO'
  | 'REMOVIDO'

/** 0 = domingo ... 6 = sábado. */
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Comunicado {
  id: number
  titulo: string
  descricao: string
  criadoPor: string
  criadoEm: string
  status: StatusComunicado
  aprovadoPor: string | null
  aprovadoEm: string | null
  motivoRejeicao: string | null
  dataInicio: string
  dataFim: string
  recorrente: boolean
  diaSemana: DiaSemana | null
  anexoUrl: string | null
  anexoTipo: 'IMAGEM' | 'PDF' | null
}

export interface CriarComunicadoInput {
  titulo: string
  descricao: string
  // Obrigatórios quando recorrente=false; omitidos quando recorrente=true.
  dataInicio?: string
  dataFim?: string
  recorrente?: boolean
  diaSemana?: DiaSemana
}