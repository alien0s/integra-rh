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
}

const estadoInicial: EstadoDetalheQualificacao = {
  aberto: false,
  referenciaTabela: null,
  referenciaId: null,
  nomeFuncionario: null,
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
