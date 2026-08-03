export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  departamento?: string;
  funcao?: string;
  avatar?: string;
}

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
