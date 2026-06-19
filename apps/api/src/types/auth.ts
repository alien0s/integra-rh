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
