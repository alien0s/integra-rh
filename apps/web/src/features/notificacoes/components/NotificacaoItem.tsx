import { useState, type MouseEvent } from 'react'
import {
  AlertTriangle,
  Coffee,
  FileText,
  GraduationCap,
  Paperclip,
  Palmtree,
  Loader2,
  type LucideIcon,
} from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import { toast } from '@/hooks/use-toast'

import {
  ehNotificacaoDeFerias,
  ROTA_POR_TIPO_OBRIGACAO,
  type Notificacao,
  type NotificacaoCartaoIcone,
} from '@/features/notificacoes/types'
import {
  abrirAnexoDaNotificacao,
  ehNotificacaoDeQualificacao,
  temAnexoParaVer,
} from '@/features/notificacoes/lib/anexoNotificacao'

interface NotificacaoItemProps {
  notificacao: Notificacao
  onAprovar?: (id: string) => void
  onRecusar?: (id: string, motivo: string) => void
  /** Clicar na linha (fora dos botões) — ex.: ir pra /ferias. */
  onAbrir?: () => void
}

/** Ícone do cartão de ação conforme o tipo do recurso. */
const iconePorTipo: Record<NotificacaoCartaoIcone, LucideIcon> = {
  arquivo: Paperclip,
  documento: FileText,
  curso: GraduationCap,
  obrigacao: AlertTriangle,
  folga: Coffee,
}

/** Uma linha de notificação dentro do drawer. */
export function NotificacaoItem({
  notificacao,
  onAprovar,
  onRecusar,
  onAbrir,
}: NotificacaoItemProps) {
  const IconeCartao = notificacao.cartao
    ? iconePorTipo[notificacao.cartao.icone ?? 'arquivo']
    : null

  // Motivo obrigatório na recusa (mesma regra da tela de Férias).
  const [motivo, setMotivo] = useState('')
  // "Ver arquivo" (diploma/certificado) — Cursos e Qualificações.
  const [abrindoAnexo, setAbrindoAnexo] = useState(false)

  async function handleVerArquivo(e: MouseEvent) {
    e.stopPropagation()
    setAbrindoAnexo(true)
    try {
      await abrirAnexoDaNotificacao(notificacao)
    } catch (erro) {
      toast({
        title: 'Não foi possível abrir o arquivo',
        description: erro instanceof Error ? erro.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setAbrindoAnexo(false)
    }
  }
  // Card do DP (2ª etapa) confirma; card do gestor aprova.
  const rotuloAprovar = notificacao.tipo?.endsWith('_AGUARDA_DP')
    ? 'Confirmar'
    : 'Aprovar'

  // Notificações de férias (evento) navegam pra /ferias; notificações de
  // obrigação recorrente (tipo prefixado "OBRIGACAO_") navegam conforme o
  // mapa ROTA_POR_TIPO_OBRIGACAO; notificações de qualificação (formação/
  // curso/idioma cadastrados) abrem o DetalheQualificacaoDialog — as demais
  // não são clicáveis.
  const podeAbrir =
    Boolean(onAbrir) &&
    (notificacao.referenciaTabela === 'ferias_solicitacoes' ||
      Boolean(notificacao.tipo && ROTA_POR_TIPO_OBRIGACAO[notificacao.tipo]) ||
      ehNotificacaoDeQualificacao(notificacao))

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent',
        !notificacao.lida && 'bg-accent/40',
        podeAbrir && 'cursor-pointer',
      )}
      onClick={podeAbrir ? () => onAbrir?.() : undefined}
      role={podeAbrir ? 'button' : undefined}
    >
      <Avatar className="h-10 w-10 rounded-lg">
        {ehNotificacaoDeFerias(notificacao.tipo) ? (
          <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">
            <Palmtree className="h-5 w-5" />
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

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm leading-snug text-foreground">
              {notificacao.nome ? (
                <span className="font-semibold">{notificacao.nome} </span>
              ) : null}
              {notificacao.acao}
            </p>
            <p className="text-xs text-muted-foreground">
              {notificacao.tempo} • {notificacao.detalhe}
            </p>
          </div>
          {!notificacao.lida ? (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
          ) : null}
        </div>

        {/* Cartão de ação embutido (inspirado no pedido de acesso). */}
        {notificacao.cartao ? (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                {IconeCartao ? (
                  <IconeCartao className="h-4 w-4 text-muted-foreground" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {notificacao.cartao.titulo}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {notificacao.cartao.subtitulo}
                </p>
              </div>
            </div>

            {temAnexoParaVer(notificacao) ? (
              <Button
                variant="link"
                size="sm"
                className="mt-2 h-auto gap-1.5 p-0 text-xs"
                disabled={abrindoAnexo}
                onClick={handleVerArquivo}
              >
                {abrindoAnexo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Paperclip className="h-3.5 w-3.5" />
                )}
                Ver arquivo
              </Button>
            ) : null}

            {notificacao.requerAcao ? (
              // Clique isolado — os botões não disparam a navegação da linha.
              <div
                className="mt-3 flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      Recusar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar recusa</AlertDialogTitle>
                      <AlertDialogDescription>
                        Justifique a recusa de <span className="font-medium text-foreground">{notificacao.cartao.titulo}</span>.
                        A justificativa notifica {notificacao.nome} e fica registrada.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Textarea
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Motivo da recusa…"
                      className="min-h-24"
                    />
                    <AlertDialogFooter className="flex-row justify-end gap-2 space-x-0">
                      <AlertDialogCancel className="flex-1" onClick={() => setMotivo('')}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={motivo.trim().length === 0}
                        className="flex-1 bg-red-600 text-white transition-colors hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                        onClick={() => {
                          onRecusar?.(notificacao.id, motivo.trim())
                          setMotivo('')
                        }}
                      >
                        Recusar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-500"
                    >
                      {rotuloAprovar}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{rotuloAprovar}</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deseja {rotuloAprovar.toLowerCase()} <span className="font-medium text-foreground">{notificacao.cartao.titulo}</span>?
                        Esta ação notifica {notificacao.nome}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row justify-end gap-2 space-x-0">
                      <AlertDialogCancel className="flex-1">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="flex-1 bg-green-600 text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-500"
                        onClick={() => onAprovar?.(notificacao.id)}
                      >
                        {rotuloAprovar}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
