import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

import { abrirDetalheQualificacao } from '@/features/cursos/lib/detalheQualificacaoStore'
import { useNotificacoes } from '@/features/notificacoes/hooks'
import { useNotificacaoToasts } from '@/features/notificacoes/hooks/useNotificacaoToasts'
import { NotificacaoItem } from '@/features/notificacoes/components/NotificacaoItem'
import { ehNotificacaoDeQualificacao } from '@/features/notificacoes/lib/anexoNotificacao'
import { ROTA_POR_TIPO_OBRIGACAO, type Notificacao } from '@/features/notificacoes/types'

/**
 * Sino de notificações no header. Abre um drawer lateral (direita) com a lista
 * de notificações, quantidade de não lidas e ação de marcar todas como lidas.
 */
export function NotificacoesDrawer() {
  const {
    notificacoes,
    naoLidas,
    marcarTodasComoLidas,
    marcarComoLida,
    aprovar,
    recusar,
  } = useNotificacoes()
  const [aberto, setAberto] = useState(false)
  const navigate = useNavigate()

  // Clicar no corpo de uma notificação: férias (evento) vai pra /ferias;
  // obrigação recorrente (tipo prefixado "OBRIGACAO_") segue o mapa
  // ROTA_POR_TIPO_OBRIGACAO; qualificação (formação/curso/idioma cadastrados)
  // vai pra /cursos E abre o DetalheQualificacaoDialog (store global — ver
  // abrirDetalheQualificacao; o dialog é montado uma vez em App.tsx, não
  // aqui, porque esta navegação desmonta este componente antes de o estado
  // "local" ter chance de ser lido). Os botões Aprovar/Recusar, dentro do
  // cartão, têm clique isolado — não disparam esta navegação.
  function abrirNotificacao(notificacao: Notificacao) {
    setAberto(false)
    if (ehNotificacaoDeQualificacao(notificacao)) {
      abrirDetalheQualificacao({
        referenciaTabela: notificacao.referenciaTabela,
        referenciaId: notificacao.referenciaId,
        nomeFuncionario: notificacao.nome,
      })
      navigate('/cursos')
      return
    }
    const rota = notificacao.tipo ? ROTA_POR_TIPO_OBRIGACAO[notificacao.tipo] : undefined
    navigate(rota ?? '/ferias')
  }

  // Ao carregar (login/app), mostra as acionáveis como toasts (Sonner) com os
  // botões de aprovar/recusar — sem precisar abrir o drawer.
  useNotificacaoToasts(notificacoes, aprovar, recusar, abrirNotificacao, marcarComoLida)

  return (
    <Drawer direction="right" open={aberto} onOpenChange={setAberto}>
      <DrawerTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground"
          aria-label="Notificações"
          // Tira o foco do próprio botão antes do drawer abrir — sem isso, o
          // Radix marca este botão (ainda focado) como aria-hidden ao abrir o
          // portal, e o Chrome acusa "Blocked aria-hidden on an element
          // because its descendant retained focus" no console.
          onClick={(event) => event.currentTarget.blur()}
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
                  onAprovar={aprovar}
                  onRecusar={recusar}
                  onAbrir={() => {
                    marcarComoLida(notificacao.id)
                    abrirNotificacao(notificacao)
                  }}
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
