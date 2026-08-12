/** Identidade mínima do usuário real por trás de uma sessão personificada. */
export interface PersonificadoPor {
  id: string;
  email: string;
  nome: string;
}

export interface AuthUser {
  papelCodigo?: string;
  id: string;
  email: string;
  nome: string;
  departamento?: string;
  funcao?: string;
  avatar?: string;
  /**
   * Presente quando esta sessão é uma personificação: identifica quem é o
   * usuário real (que iniciou a personificação), para exibir na UI e para a
   * rota de encerrar-personificação saber para quem voltar.
   */
  personificadoPor?: PersonificadoPor;
}

/** Papéis com permissão para personificar outro usuário. */
export const PAPEIS_QUE_PODEM_PERSONIFICAR = ["ADMIN", "RH"] as const;

export interface AuthTokenResponse {
  token: string;
  user: AuthUser;
}

export interface LoginRequestBody {
  email: string;
  password: string;
}

export interface CheckEmailBody {
  email: string;
}

export interface CheckEmailResponse {
  /** 'login' = já tem senha; 'criar-senha' = 1º acesso, precisa definir. */
  mode: "login" | "criar-senha";
}

export interface SetPasswordBody {
  email: string;
  password: string;
}

export interface UpdateMeuPerfilBody {
  cpf: string | null;
  telefone: string | null;
}
