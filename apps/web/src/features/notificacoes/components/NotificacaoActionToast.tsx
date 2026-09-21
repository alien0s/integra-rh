import { useState } from 'react'
import { Palmtree, X } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ehNotificacaoDeFerias, type Notificacao } from '@/features/notificacoes/types'

interface NotificacaoActionToastProps {
  notificacao: Notificacao
  /** Aprova (gestor) ou confirma (DP) — o hook decide pela etapa. */
  onAprovar: (id: string) => Promise<void> | void
  /** Recusa com motivo obrigatório. */
  onRecusar: (id: string, motivo: string) => Promise<void> | void
  /** Fecha o toast. */
  onClose: () => void
  /** Clicar no corpo (fora dos botões/X) — ex.: ir pra /ferias. */
  onAbrir?: () => void
}

/**
 * Card de uma notificação ACIONÁVEL renderizado dentro de um toast do Sonner
 * (aparece ao logar). Reusa a mesma linguagem visual do drawer de notificações
 * e permite o gestor/DP aprovar ou recusar direto do toast — a recusa revela
 * um campo de motivo (obrigatório) sem sair do toast.
 */
export function NotificacaoActionToast({
  notificacao,
  onAprovar,
  onRecusar,
  onClose,
  onAbrir,
}: NotificacaoActionToastProps) {
  const [modo, setModo] = useState<'idle' | 'recusando'>('idle')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Card do DP (2ª etapa) confirma; card do gestor aprova.
  const rotuloAprovar = notificacao.tipo?.endsWith('_AGUARDA_DP')
    ? 'Confirmar'
    : 'Aprovar'

  async function aprovar() {
    setEnviando(true)
    try {
      await onAprovar(notificacao.id)
      onClose()
    } finally {
      setEnviando(false)
    }
  }

  async function recusar() {
    if (motivo.trim().length === 0) return
    setEnviando(true)
    try {
      await onRecusar(notificacao.id, motivo.trim())
      onClose()
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className={`w-[356px] rounded-lg border bg-card p-3 font-sans text-card-foreground shadow-lg ${
        onAbrir ? 'cursor-pointer' : ''
      }`}
      onClick={() => onAbrir?.()}
      role={onAbrir ? 'button' : undefined}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-9 w-9 rounded-lg">
          {ehNotificacaoDeFerias(notificacao.tipo) ? (
            <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">
              <Palmtree className="h-4 w-4" />
            </AvatarFallback>
          ) : (
            <>
              <AvatarImage src={notificacao.avatar} alt={notificacao.nome} />
              <AvatarFallback className="rounded-lg text-xs font-semibold">
                {notificacao.iniciais}
              </AvatarFallback>
            </>
          )}
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug">
            {notificacao.nome ? (
              <span className="font-semibold">{notificacao.nome} </span>
            ) : null}
            {notificacao.acao}
          </p>
          {notificacao.detalhe ? (
            <p className="truncate text-xs text-muted-foreground">
              {notificacao.tempo} • {notificacao.detalhe}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          aria-label="Dispensar"
          className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Rodapé de ações: clique isolado — não dispara a navegação do corpo. */}
      {modo === 'idle' ? (
        <div
          className="mt-3 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
            onClick={() => setModo('recusando')}
            disabled={enviando}
          >
            Recusar
          </Button>
          <Button
            size="sm"
            className="flex-1 bg-green-600 text-white hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-500"
            onClick={aprovar}
            disabled={enviando}
          >
            {rotuloAprovar}
          </Button>
        </div>
      ) : (
        <div
          className="mt-3 flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da recusa…"
            className="min-h-20 text-sm"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                setModo('idle')
                setMotivo('')
              }}
              disabled={enviando}
            >
              Voltar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1"
              onClick={recusar}
              disabled={enviando || motivo.trim().length === 0}
            >
              Confirmar recusa
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
