import { useMemo, useState } from 'react'
import { CalendarRange, LayoutGrid } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { usePreferenciaVisaoFerias } from '@/lib/preferencias'
import { useAuthUser } from '@/features/auth/hooks'
import { useUsuarios } from '@/features/usuarios/hooks'
import type { RegistrarFeriasManualInput } from '@/features/ferias/services'
import type { SolicitacaoFerias } from '@/features/ferias/types'
import { EquipeCalendarDialog } from './EquipeCalendarDialog'
import { ExcecoesFeriasDialog } from './ExcecoesFeriasDialog'
import { FeriasRequestList } from './FeriasRequestList'
import { FeriasTimeline } from './FeriasTimeline'
import { ImprimirMapaFeriasButton } from './ImprimirMapaFeriasButton'
import { RegistrarFeriasManualDialog } from './RegistrarFeriasManualDialog'
import { VisaoGeralDpRhDialog } from './VisaoGeralDpRhDialog'

type FiltroStatus = 'TODOS' | 'PENDENTE' | 'AGUARDANDO_DP'

/** Papéis com permissão para registrar férias/folga manualmente (espelha a API). */
const PAPEIS_QUE_PODEM_REGISTRAR_MANUAL = new Set(['ADMIN', 'RH', 'COORDENADOR DP'])
/** Papéis que veem o painel de visão geral (DP só visualiza; COORD. DP e RH agem). */
const PAPEIS_DP_RH = new Set(['ADMIN', 'RH', 'DP', 'COORDENADOR DP'])
/** Papéis que podem gerir as exceções de férias (fracionar/vender) — espelha a API. */
const PAPEIS_EXCECOES = new Set(['ADMIN', 'DP', 'COORDENADOR DP'])

// Estilo dos botões de modo de visualização (mesma referência da tela de Usuários).
const viewButtonClassName =
  'text-muted-foreground hover:bg-muted hover:text-foreground'
const activeViewButtonClassName = 'bg-muted text-foreground hover:bg-muted'

interface FeriasOverviewProps {
  solicitacoes: SolicitacaoFerias[]
  onAprovar?: (id: string) => void
  onConfirmar?: (id: string) => void
  onSugerirAjuste?: (id: string, dataInicioSugerida: string, motivo: string) => void
  onAceitarAjuste?: (id: string) => Promise<unknown> | void
  onRejeitar?: (id: string, motivo: string) => void
  onCancelar?: (id: string, motivo?: string | null) => void
  onRegistrarManual?: (input: RegistrarFeriasManualInput) => Promise<void>
}

/**
 * Seção "Requisições" da Visão geral de Férias: título, filtro por status,
 * ações por papel (gestor aprova; DP confirma/cancela), registro manual,
 * calendário da equipe (gestor) e a visão geral DP/RH (quem entra / precisa tirar).
 */
export function FeriasOverview({
  solicitacoes,
  onAprovar,
  onConfirmar,
  onSugerirAjuste,
  onAceitarAjuste,
  onRejeitar,
  onCancelar,
  onRegistrarManual,
}: FeriasOverviewProps) {
  const [filtro, setFiltro] = useState<FiltroStatus>('TODOS')
  const [modo, setModo] = usePreferenciaVisaoFerias()
  const usuarioLogado = useAuthUser()
  const { usuarios } = useUsuarios()

  const papel = usuarioLogado?.papelCodigo
  const ehGestor = papel === 'GESTOR'
  const ehDpRh = Boolean(papel && PAPEIS_DP_RH.has(papel))
  const podeRegistrarManual = Boolean(papel && PAPEIS_QUE_PODEM_REGISTRAR_MANUAL.has(papel))
  const podeGerirExcecoes = Boolean(papel && PAPEIS_EXCECOES.has(papel))

  const filtradas = useMemo(() => {
    // Canceladas não aparecem na visão geral (nem cards nem linha do tempo).
    const visiveis = solicitacoes.filter((s) => s.status !== 'CANCELADA')
    return filtro === 'TODOS'
      ? visiveis
      : visiveis.filter((s) => s.status === filtro)
  }, [solicitacoes, filtro])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Solicitações de férias</h2>
            <div className="flex items-center gap-2">
              {ehGestor && <EquipeCalendarDialog />}
              {ehDpRh && (
                <>
                  <ImprimirMapaFeriasButton />
                  <VisaoGeralDpRhDialog />
                </>
              )}
              {podeGerirExcecoes && <ExcecoesFeriasDialog />}
              {podeRegistrarManual && onRegistrarManual && (
                <RegistrarFeriasManualDialog usuarios={usuarios} onRegistrar={onRegistrarManual} />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filtro} onValueChange={(value) => setFiltro(value as FiltroStatus)}>
              <TabsList className="h-9">
                <TabsTrigger value="TODOS" className="px-4">
                  Todos
                </TabsTrigger>
                <TabsTrigger value="PENDENTE" className="px-4">
                  Aprovação gestor
                </TabsTrigger>
                <TabsTrigger value="AGUARDANDO_DP" className="px-4">
                  Confirmação DP
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Alternador de modo de visualização (persistido) — mesmo estilo
                da tela de Usuários (ghost com ícone + texto; ativo = bg-muted). */}
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className={modo === 'cards' ? activeViewButtonClassName : viewButtonClassName}
                aria-pressed={modo === 'cards'}
                onClick={() => setModo('cards')}
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={modo === 'timeline' ? activeViewButtonClassName : viewButtonClassName}
                aria-pressed={modo === 'timeline'}
                onClick={() => setModo('timeline')}
              >
                <CalendarRange className="h-4 w-4" />
                Linha do tempo
              </Button>
            </div>
          </div>
        </div>

        {modo === 'timeline' ? (
          <FeriasTimeline solicitacoes={filtradas} />
        ) : (
          <FeriasRequestList
            solicitacoes={filtradas}
            papel={papel}
            usuarioLogadoId={usuarioLogado?.id}
            onAprovar={onAprovar}
            onConfirmar={onConfirmar}
            onSugerirAjuste={onSugerirAjuste}
            onAceitarAjuste={onAceitarAjuste}
            onRejeitar={onRejeitar}
            onCancelar={onCancelar}
          />
        )}
      </div>
    </div>
  )
}
