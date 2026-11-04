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
  /** Grupo/união da entidade do usuário (UNoB, ANRA, ACeAm, Asur, AAmaR, MLa) ou null. */
  entidadeGrupo: string | null
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

/**
 * Campos editáveis de um usuário (modal de edição). CPF não está aqui de
 * propósito — só vem do sistema legado (ver EditarUsuarioModal.tsx).
 */
export interface AtualizarUsuarioInput {
  telefone: string | null
  setorId: string | null
  entidadeId: string | null
  funcaoId: string | null
  /** Código do papel/perfil de acesso (ex.: "ADMIN") ou null. */
  roleCodigo: string | null
  /**
   * Código do estado civil (ex.: "SOLTEIRO") — OPCIONAL: só o modo
   * `apenasContato` (autoatendimento do colaborador, em EditarUsuarioModal)
   * preenche e envia. A edição completa do ADMIN nunca inclui este campo —
   * o backend nem aceita (PATCH /usuarios/:usuarioId não tem essa
   * propriedade no schema).
   */
  estadoCivilCodigo?: string | null
}

/**
 * Campos de um usuário criado manualmente pelo ADMIN (ver
 * CriarUsuarioDialog.tsx) — ao contrário da edição, aqui tudo é obrigatório:
 * é um cadastro novo, não um ajuste parcial. Os demais dados (cpf, telefone,
 * datas, salário...) vêm do legado no 1º login dessa pessoa.
 */
export interface CriarUsuarioInput {
  nome: string
  email: string
  entidadeId: string
  setorId: string
  /** Código do papel/perfil de acesso (ex.: "COLABORADOR", "ADMIN"). */
  roleCodigo: string
  /** Tipo de vínculo (CLT): "COLABORADOR" ou "APRENDIZ/ESTAGIÁRIO". */
  tipoFuncionario: string
}

/**
 * Uma atividade recente do usuário — o que ELE fez no sistema OU o que
 * aconteceu pra ele (uma decisão de outra pessoa, ex.: "RH aprovou seu
 * diploma"). Exibida no card "Atividades recentes" do perfil.
 */
export interface AtividadeUsuario {
  id: string
  acao: string
  detalhe: string
  tempo: string
  /** Nome da outra pessoa envolvida — pra quem foi (se o dono do perfil foi
   * quem agiu) ou quem fez (se algo aconteceu pro dono do perfil). */
  contraparteNome: string
  /** true = o dono do perfil foi quem agiu; false = alguém agiu sobre ele. */
  euFizFoi: boolean
  icone: 'arquivo' | 'documento' | 'curso' | 'obrigacao' | 'folga' | 'divergencia' | 'ferias'
}
