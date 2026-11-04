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
  setor?: string;
  funcao?: string;
  avatar?: string;
  /**
   * Presente quando esta sessão é uma personificação: identifica quem é o
   * usuário real (que iniciou a personificação), para exibir na UI e para a
   * rota de encerrar-personificação saber para quem voltar.
   */
  personificadoPor?: PersonificadoPor;
  /**
   * Códigos de módulo (moduloCodigo no front, ver AppSidebar.tsx) que este
   * papel NÃO pode ver/acessar — calculado no login a partir da tabela
   * modulos_visibilidade (ver calcularModulosRestritos em auth.routes.ts).
   * ADMIN e modo dev (papelCodigo undefined) sempre [].
   */
  modulosRestritos?: string[];
  /**
   * Códigos de módulo liberados ANTECIPADAMENTE (sem cadeado) pra este papel
   * durante o lançamento beta — calculado no login a partir de
   * modulos_visibilidade.liberado_antecipado (ver
   * calcularModulosBetaLiberados em auth.routes.ts). ADMIN e modo dev
   * (papelCodigo undefined) sempre liberados, independente desta lista.
   */
  modulosBetaLiberados?: string[];
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

/** CPF não está aqui de propósito — só o sistema legado escreve CPF. */
export interface UpdateMeuPerfilBody {
  telefone: string | null;
  /**
   * Código do estado civil (ex.: "SOLTEIRO", ver tabela `estados_civis`) —
   * opcional porque só o autoatendimento (modo `apenasContato` de
   * EditarUsuarioModal.tsx) o envia hoje. Trafega como CÓDIGO, nunca o UUID
   * — resolvido no backend via subquery, igual roleCodigo/resolverRoleId.
   */
  estadoCivilCodigo?: string | null;
}
