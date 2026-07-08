/**
 * Types locais do módulo de Configurações (Configuracoes).
 */

/** Seções da tela de configurações (nav lateral). */
export type ConfiguracoesSection =
  | 'perfil'
  | 'conta'
  | 'aparencia'
  | 'notificacoes'
  | 'exibicao'

/** Campos editáveis do perfil do próprio usuário. */
export interface PerfilFormData {
  nome: string
  cpf: string
  telefone: string
}
