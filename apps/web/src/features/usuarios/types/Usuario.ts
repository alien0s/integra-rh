/**
 * Representa um usuário exibido na listagem de pessoas do sistema.
 */
export interface Usuario {
  id: string
  nome: string
  email: string
  funcao: string
  setor: string
  entidade: string | null
  status: 'Ativo' | 'Inativo'
  fotoUrl: string
  iniciais: string
  /** Campos de perfil (espelham a tabela users) — opcionais. */
  telefone?: string
  cpf?: string
  salario?: number
  dataAdmissao?: string
  dataDemissao?: string
  gestor?: string
  ultimoAcesso?: string
  /** Papel/perfil de acesso — código (ex.: "ADMIN"), único por usuário. */
  papelCodigo?: string | null
  /** Nome do papel para exibição (ex.: "Administrador do sistema"). */
  papel?: string | null
  /** Dados pessoais/bancários (espelham a tabela users). */
  dataNascimento?: string | null
  /** Sexo: 1 = masculino, 0 = feminino. */
  sexo?: number | null
  estadoCivil?: string | null
  cidade?: string | null
  /** UF (2 letras). */
  estado?: string | null
  pis?: string | null
  numeroBanco?: string | null
  numeroConta?: string | null
  digitoConta?: string | null
  /** Código de matrícula do funcionário no APS (enrollment_code), ex.: "1119". */
  codigoAps?: string | null
  /** Código APS + código da entidade combinados, ex.: "1119164122". */
  codigoApsEntidade?: string | null
  /** Tipo de vínculo (CLT): "COLABORADOR" (padrão) ou "APRENDIZ/ESTAGIÁRIO". */
  tipoFuncionario?: string | null
}

export type UsuarioTableColumn =
  | 'nome'
  | 'email'
  | 'funcao'
  | 'setor'
  | 'status'

/** Modo de visualização da listagem de usuários. */
export type UsuarioView = 'tabela' | 'quadro' | 'lista'

/** Opção genérica id/nome para dropdowns (setores, funções). */
export interface OpcaoSelecao {
  id: string
  nome: string
  /** Só nos setores: nome do gestor atual (para avisar antes de substituir). */
  gestorNome?: string | null
}

/** Campos editáveis de um usuário (modal de edição). */
export interface AtualizarUsuarioInput {
  cpf: string | null
  telefone: string | null
  setorId: string | null
  entidadeId: string | null
  funcaoId: string | null
  /** Código do papel/perfil de acesso (ex.: "ADMIN") ou null. */
  roleCodigo: string | null
}

/**
 * Uma atividade recente do usuário (o que ELE fez no sistema — não uma
 * notificação que recebeu). Exibida no card "Atividades recentes" do perfil.
 */
export interface AtividadeUsuario {
  id: string
  acao: string
  detalhe: string
  tempo: string
  /** Para quem essa ação foi (ex.: quem recebeu a férias aprovada/recusada). */
  destinatarioNome: string
  icone: 'arquivo' | 'documento' | 'curso' | 'obrigacao'
}
