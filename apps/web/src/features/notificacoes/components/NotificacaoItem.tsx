import { FileText, GraduationCap, Paperclip, type LucideIcon } from 'lucide-react'

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
import { cn } from '@/lib/cn'

import type {
  Notificacao,
  NotificacaoCartaoIcone,
} from '@/features/notificacoes/types'

interface NotificacaoItemProps {
  notificacao: Notificacao
  onAprovar?: (id: string) => void
  onRecusar?: (id: string) => void
}

/** Ícone do cartão de ação conforme o tipo do recurso. */
const iconePorTipo: Record<NotificacaoCartaoIcone, LucideIcon> = {
  arquivo: Paperclip,
  documento: FileText,
  curso: GraduationCap,
}

/** Uma linha de notificação dentro do drawer. */
export function NotificacaoItem({
  notificacao,
  onAprovar,
  onRecusar,
}: NotificacaoItemProps) {
  const IconeCartao = notificacao.cartao
    ? iconePorTipo[notificacao.cartao.icone ?? 'arquivo']
    : null

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-accent',
        !notificacao.lida && 'bg-accent/40',
      )}
    >
      <Avatar className="h-10 w-10 rounded-lg">
        <AvatarImage src={notificacao.avatar} alt={notificacao.nome} />
        <AvatarFallback className="rounded-lg text-xs font-semibold">
          {notificacao.iniciais}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm leading-snug text-foreground">
              <span className="font-semibold">{notificacao.nome}</span>{' '}
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

            {notificacao.requerAcao ? (
              <div className="mt-3 flex items-center gap-2">
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
                        Deseja recusar <span className="font-medium text-foreground">{notificacao.cartao.titulo}</span>?
                        Esta ação notifica {notificacao.nome} e não pode ser desfeita por aqui.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-row justify-end gap-2 space-x-0">
                      <AlertDialogCancel className="flex-1">
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        className="flex-1 bg-red-600 text-white transition-colors hover:bg-red-700 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                        onClick={() => onRecusar?.(notificacao.id)}
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
                      Aprovar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar aprovação</AlertDialogTitle>
                      <AlertDialogDescription>
                        Deseja aprovar <span className="font-medium text-foreground">{notificacao.cartao.titulo}</span>?
                        Esta ação notifica {notificacao.nome} e não pode ser desfeita por aqui.
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
                        Aprovar
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
