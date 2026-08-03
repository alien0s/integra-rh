import { Bell, Check } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

import { useNotificacoes } from '@/features/notificacoes/hooks'
import { NotificacaoItem } from '@/features/notificacoes/components/NotificacaoItem'

/**
 * Sino de notificações no header. Abre um drawer lateral (direita) com a lista
 * de notificações, quantidade de não lidas e ação de marcar todas como lidas.
 */
export function NotificacoesDrawer() {
  const { notificacoes, naoLidas, marcarTodasComoLidas, responder } =
    useNotificacoes()

  return (
    <Drawer direction="right">
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground"
          aria-label="Notificações"
        >
          <Bell className="h-5 w-5" />
          {naoLidas > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-card" />
          ) : null}
        </Button>
      </DrawerTrigger>

      <DrawerContent className="p-0">
        <DrawerHeader className="flex-row items-center justify-between border-b px-4 py-3 text-left">
          <div className="space-y-0.5">
            <DrawerTitle>Notificações</DrawerTitle>
            <DrawerDescription>
              {naoLidas > 0
                ? `${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`
                : 'Tudo em dia'}
            </DrawerDescription>
          </div>
          {naoLidas > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={marcarTodasComoLidas}
            >
              <Check className="h-3.5 w-3.5" />
              Marcar como lidas
            </Button>
          ) : null}
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-2">
          {notificacoes.length > 0 ? (
            <div className="space-y-1">
              {notificacoes.map((notificacao) => (
                <NotificacaoItem
                  key={notificacao.id}
                  notificacao={notificacao}
                  onAprovar={responder}
                  onRecusar={responder}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma notificação por aqui.
              </p>
            </div>
          )}
        </div>

        <div className="border-t p-3">
          <DrawerClose asChild>
            <Button variant="outline" className="w-full">
              Fechar
            </Button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
