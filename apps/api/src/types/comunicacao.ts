export type StatusComunicado =
  | "RASCUNHO"
  | "AGUARDANDO_APROVACAO"
  | "APROVADO"
  | "REJEITADO"
  | "PUBLICADO"
  | "ENCERRADO"
  | "REMOVIDO";

export type AnexoTipo = "IMAGEM" | "PDF";

// 0 = domingo ... 6 = sábado, igual ao CHECK da migration
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Comunicado {
  id: number;
  titulo: string;
  descricao: string;

  criadoPor: string; // uuid do usuário (users.id)
  criadoEm: Date;

  status: StatusComunicado;

  aprovadoPor: string | null;
  aprovadoEm: Date | null;
  motivoRejeicao: string | null;

  removidoPor: string | null;
  removidoEm: Date | null;

  dataInicio: string; // formato YYYY-MM-DD
  dataFim: string;

  recorrente: boolean;
  diaSemana: DiaSemana | null;

  anexoUrl: string | null;
  anexoTipo: AnexoTipo | null;

  updatedAt: Date;
}

export interface ComunicadoPublicacao {
  id: number;
  comunicadoId: number;

  publicadoEm: Date;
  expiraEm: Date;

  encerradoManualmente: boolean;
  encerradoPor: string | null;
  encerradoEm: Date | null;

  createdAt: Date;
}

// ---- Inputs das rotas ----

export interface CriarComunicadoInput {
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  recorrente?: boolean;
  diaSemana?: DiaSemana;
  anexoUrl?: string;
  anexoTipo?: AnexoTipo;
}

export interface AprovarComunicadoInput {
  comunicadoId: number;
}

export interface RejeitarComunicadoInput {
  comunicadoId: number;
  motivoRejeicao: string;
}

export interface RemoverComunicadoInput {
  comunicadoId: number;
}
