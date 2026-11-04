/**
 * Types locais do módulo de Logs (erros do backend + erros de front-end
 * reportados pelo navegador — ver origem).
 */
export type OrigemLogErro = 'backend' | 'frontend'

export interface LogErro {
  id: string
  origem: OrigemLogErro
  modulo: string
  rota: string
  codigo: string
  /** null quando origem = 'frontend' (não houve requisição, não tem status HTTP). */
  statusHttp: number | null
  mensagem: string
  stack: string | null
  usuarioId: string | null
  usuarioNome: string | null
  usuarioEmail: string | null
  createdAt: string
}
