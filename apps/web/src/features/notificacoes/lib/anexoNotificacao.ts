import { cursosService } from '@/features/cursos/services'
import type { TabelaQualificacao } from '@/features/cursos/types'
import { abrirArquivo } from '@/features/visualizador-arquivo'
import type { Notificacao } from '@/features/notificacoes/types'

/** As 3 tabelas de qualificação — mesmo valor usado em `referencia_tabela`. */
const TABELAS_QUALIFICACAO = new Set<TabelaQualificacao>([
  'qualificacoes_academicas',
  'qualificacoes_cursos',
  'qualificacoes_idiomas',
])

/**
 * Tabelas de qualificações que têm arquivo anexado — diploma (formação) ou
 * certificado (curso/workshop/certificação). Idiomas nunca têm anexo (não
 * existe a coluna na tabela `qualificacoes_idiomas`).
 */
const TABELAS_COM_ANEXO = new Set(['qualificacoes_academicas', 'qualificacoes_cursos'])

/**
 * A notificação é sobre um cadastro de qualificação (formação/curso/idioma)
 * — clicar no corpo dela abre o DetalheQualificacaoDialog (ver
 * NotificacoesDrawer) em vez de navegar direto.
 */
export function ehNotificacaoDeQualificacao(
  notificacao: Notificacao,
): notificacao is Notificacao & { referenciaTabela: TabelaQualificacao; referenciaId: string } {
  return Boolean(
    notificacao.referenciaTabela &&
      TABELAS_QUALIFICACAO.has(notificacao.referenciaTabela as TabelaQualificacao) &&
      notificacao.referenciaId,
  )
}

/** A notificação aponta pra um registro com um arquivo pra ver antes de decidir. */
export function temAnexoParaVer(notificacao: Notificacao): boolean {
  return (
    Boolean(notificacao.temArquivo) &&
    Boolean(notificacao.referenciaTabela && TABELAS_COM_ANEXO.has(notificacao.referenciaTabela)) &&
    Boolean(notificacao.referenciaId)
  )
}

/**
 * Baixa e abre no visualizador universal (ver features/visualizador-arquivo)
 * o anexo referenciado pela notificação — diploma de uma formação acadêmica
 * ou certificado de um curso/workshop/certificação.
 */
export async function abrirAnexoDaNotificacao(notificacao: Notificacao): Promise<void> {
  if (!notificacao.referenciaId) return
  const blob =
    notificacao.referenciaTabela === 'qualificacoes_academicas'
      ? await cursosService.baixarAnexoFormacao(notificacao.referenciaId)
      : await cursosService.baixarCertificadoCurso(notificacao.referenciaId)
  abrirArquivo({ blob, titulo: notificacao.cartao?.titulo })
}
