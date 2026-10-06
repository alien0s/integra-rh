import { useEffect, useState } from 'react'

/**
 * Store global (fora do React, mesmo padrão do hooks/use-toast.ts) pro
 * visualizador de arquivo: qualquer módulo chama `abrirArquivo()` direto,
 * sem precisar de contexto/provider — só precisa que `VisualizadorArquivoDialog`
 * esteja montado uma vez na raiz do app (ver App.tsx).
 */

export type TipoArquivoVisualizavel = 'imagem' | 'pdf' | 'desconhecido'

interface EstadoVisualizador {
  aberto: boolean
  objectUrl: string | null
  tipo: TipoArquivoVisualizavel | null
  titulo: string | null
}

const estadoInicial: EstadoVisualizador = {
  aberto: false,
  objectUrl: null,
  tipo: null,
  titulo: null,
}

let estado: EstadoVisualizador = estadoInicial
// Object URL do blob atualmente aberto — revogada ao abrir o próximo ou ao
// fechar o dialog, nunca deixada vazando.
let objectUrlAtual: string | null = null
const listeners = new Set<(estado: EstadoVisualizador) => void>()

function emitir() {
  listeners.forEach((listener) => listener(estado))
}

function liberarObjectUrlAtual() {
  if (objectUrlAtual) {
    URL.revokeObjectURL(objectUrlAtual)
    objectUrlAtual = null
  }
}

function detectarTipo(blob: Blob): TipoArquivoVisualizavel {
  if (blob.type.startsWith('image/')) return 'imagem'
  if (blob.type === 'application/pdf') return 'pdf'
  return 'desconhecido'
}

interface AbrirArquivoOptions {
  /** Arquivo já baixado (diploma, certificado, etc.) — o tipo vem de `blob.type`. */
  blob: Blob
  /** Título mostrado no cabeçalho do dialog (ex.: nome do curso/formação). */
  titulo?: string
}

/**
 * Abre o visualizador universal de arquivo com o blob informado — reconhece
 * imagem e PDF (pré-visualiza) e cai num botão de baixar pros demais tipos.
 * Pode ser chamada de qualquer módulo (notificações, cursos, etc.), fora de
 * componentes React inclusive.
 */
export function abrirArquivo({ blob, titulo }: AbrirArquivoOptions) {
  liberarObjectUrlAtual()
  objectUrlAtual = URL.createObjectURL(blob)
  estado = {
    aberto: true,
    objectUrl: objectUrlAtual,
    tipo: detectarTipo(blob),
    titulo: titulo ?? null,
  }
  emitir()
}

/** Fecha o dialog — usado pelo próprio VisualizadorArquivoDialog (onOpenChange). */
export function fecharVisualizadorArquivo() {
  estado = { ...estado, aberto: false }
  emitir()
  // Revoga um pouco depois: deixa a animação de fechar terminar sem o
  // conteúdo sumir no meio da transição.
  setTimeout(liberarObjectUrlAtual, 300)
}

/** Lê o estado do visualizador reativamente — usado só pelo dialog em si. */
export function useVisualizadorArquivoEstado(): EstadoVisualizador {
  const [estadoAtual, setEstadoAtual] = useState(estado)

  useEffect(() => {
    listeners.add(setEstadoAtual)
    return () => {
      listeners.delete(setEstadoAtual)
    }
  }, [])

  return estadoAtual
}
