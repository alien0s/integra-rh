import { useEffect, useState } from 'react'

import type { TabelaQualificacao } from '../types'

/**
 * Store global (fora do React, mesmo padrão do visualizador de arquivo —
 * ver features/visualizador-arquivo/lib/visualizadorArquivoStore.ts) pro
 * dialog de detalhe de uma qualificação: qualquer módulo chama
 * `abrirDetalheQualificacao()` direto, sem precisar de contexto/provider.
 *
 * Por quê global (e não estado local de quem abriu, ex.: NotificacoesDrawer):
 * abrir o dialog ao clicar numa notificação de qualificação navega pra
 * /cursos — e como cada página renderiza seu próprio AppLayout (sem layout
 * compartilhado entre rotas, ver App.tsx), o componente que chamou
 * `navigate()` É DESMONTADO na mesma hora pela troca de rota. Um estado
 * local nele morreria junto, e o dialog nunca chegaria a aparecer na
 * página de destino. Por isso o dialog em si também é montado uma vez na
 * raiz do app (ver App.tsx), igual ao VisualizadorArquivoDialog.
 */

interface EstadoDetalheQualificacao {
  aberto: boolean
  referenciaTabela: TabelaQualificacao | null
  referenciaId: string | null
  /** Nome de quem cadastrou — normalmente já vem da notificação clicada. */
  nomeFuncionario: string | null
  /**
   * Incrementa toda vez que uma decisão (aprovar/recusar) é concluída com
   * sucesso — NÃO quando o dialog só fecha sem decidir nada. Permite quem
   * abriu o dialog (ex.: QualificacoesPendentesDialog) saber que precisa
   * recarregar a própria lista, sem recarregar à toa (e bater no banco)
   * todo fechamento, inclusive os que não mudaram nada.
   */
  decisoes: number
}

const estadoInicial: EstadoDetalheQualificacao = {
  aberto: false,
  referenciaTabela: null,
  referenciaId: null,
  nomeFuncionario: null,
  decisoes: 0,
}

let estado: EstadoDetalheQualificacao = estadoInicial
const listeners = new Set<(estado: EstadoDetalheQualificacao) => void>()

function emitir() {
  listeners.forEach((listener) => listener(estado))
}

interface AbrirDetalheQualificacaoOptions {
  referenciaTabela: TabelaQualificacao
  referenciaId: string
  nomeFuncionario?: string
}

/** Abre o dialog de detalhe — pode ser chamado de qualquer módulo. */
export function abrirDetalheQualificacao({
  referenciaTabela,
  referenciaId,
  nomeFuncionario,
}: AbrirDetalheQualificacaoOptions) {
  estado = {
    ...estado,
    aberto: true,
    referenciaTabela,
    referenciaId,
    nomeFuncionario: nomeFuncionario ?? null,
  }
  emitir()
}

/** Fecha o dialog — usado pelo próprio DetalheQualificacaoDialog (onOpenChange). */
export function fecharDetalheQualificacao() {
  estado = { ...estado, aberto: false }
  emitir()
}

/**
 * Marca que uma decisão foi tomada (aprovar/recusar com sucesso) — chamado
 * pelo próprio DetalheQualificacaoDialog logo antes de fechar. Quem
 * depende de "algo mudou" (QualificacoesPendentesDialog) observa `decisoes`
 * em vez de `aberto`, que mudaria pra qualquer fechamento.
 */
export function registrarDecisaoQualificacao() {
  estado = { ...estado, decisoes: estado.decisoes + 1 }
  emitir()
}

/** Lê o estado do dialog reativamente — usado só pelo dialog em si. */
export function useDetalheQualificacaoEstado(): EstadoDetalheQualificacao {
  const [estadoAtual, setEstadoAtual] = useState(estado)

  useEffect(() => {
    listeners.add(setEstadoAtual)
    return () => {
      listeners.delete(setEstadoAtual)
    }
  }, [])

  return estadoAtual
}
