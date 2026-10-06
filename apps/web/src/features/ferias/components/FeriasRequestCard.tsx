import { useState } from 'react'
import { addDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, Check, Clock, Coffee, Minus, Palmtree } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'

import type {
  SolicitacaoFerias,
  StatusSolicitacaoFerias,
} from '@/features/ferias/types'
import { SugerirAjusteDialog } from './sugerirajuste'

interface FeriasRequestCardProps {
  solicitacao: SolicitacaoFerias
  /** Papel do usuário logado — decide quais ações aparecem. */
  papel?: string
  /** ID do usuário logado — ninguém decide sobre a própria solicitação. */
  usuarioLogadoId?: string
  onAprovar?: (id: string) => void
  onConfirmar?: (id: string) => void
  onSugerirAjuste?: (id: string, dataInicioSugerida: string, motivo: string) => void
  onAceitarAjuste?: (id: string) => Promise<unknown> | void
  onRejeitar?: (id: string, motivo: string) => void
  onCancelar?: (id: string, motivo?: string | null) => void
}

/** Rótulo e cores de cada status exibido no topo do card. */
const STATUS_CONFIG: Record<
  StatusSolicitacaoFerias,
  { label: string; className: string }
> = {
  PENDENTE: {
    label: 'Aguardando gestor',
    className:
      'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400',
  },
  AGUARDANDO_DP: {
    label: 'Aguardando DP',
    className:
      'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  },
  AJUSTE_SUGERIDO: {
    label: 'Ajuste sugerido',
    className:
      'bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  },
  APROVADA: {
    label: 'Aprovado',
    className:
      'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  },
  REJEITADA: {
    label: 'Rejeitado',
    className:
      'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  },
  CANCELADA: {
    label: 'Cancelado',
    className:
      'bg-muted text-muted-foreground hover:bg-muted',
  },
}

// Aprovar/recusar (1ª etapa) é só do GESTOR. Confirmar (2ª etapa) é do
// COORDENADOR DP — exceto quando o próprio solicitante é COORDENADOR DP, aí quem
// confirma é o RH. O papel "DP" só visualiza (não age). Papéis do catálogo
// (004_roles.sql). ADMIN não vê os botões (o backend permite via API).
const PAPEL_COORD_DP = 'COORDENADOR DP'
const PAPEL_RH = 'RH'

/** O papel logado é o confirmador correto para este solicitante? */
function ehConfirmador(papel: string | undefined, solicitantePapel?: string): boolean {
  if (papel === undefined) return false
  return solicitantePapel === PAPEL_COORD_DP
    ? papel === PAPEL_RH
    : papel === PAPEL_COORD_DP
}

/** Estado de uma etapa de aprovação. */
type EstadoEtapa = 'feito' | 'pendente' | 'dispensado'

/**
 * Uma etapa do progresso de aprovação.
 *   - feito: aprovado por alguém (check verde + nome/data).
 *   - pendente: ainda aguardando (relógio).
 *   - dispensado: etapa pulada (ex.: setor sem gestor → foi direto ao DP).
 */
function EtapaProgresso({
  rotulo,
  nome,
  em,
  estado,
  textoDispensado = 'dispensada',
}: {
  rotulo: string
  nome?: string
  em?: string
  estado: EstadoEtapa
  textoDispensado?: string
}) {
  const feito = estado === 'feito'
  const dispensado = estado === 'dispensado'
  const Icone = feito ? Check : dispensado ? Minus : Clock
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full ${
          feito
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <Icone className="h-2.5 w-2.5" />
      </span>
      <span className="text-muted-foreground">
        {rotulo}:{' '}
        <span className={feito ? 'font-medium text-foreground' : 'italic'}>
          {feito
            ? `${nome ?? '—'}${em ? ` · ${em}` : ''}`
            : dispensado
              ? textoDispensado
              : 'pendente'}
        </span>
      </span>
    </div>
  )
}

/**
 * Card de solicitação de férias com progresso de aprovação (gestor → DP) e as
 * ações do usuário logado conforme o papel e o status.
 */
export function FeriasRequestCard({
  solicitacao,
  papel,
  usuarioLogadoId,
  onAprovar,
  onConfirmar,
  onSugerirAjuste,
  onAceitarAjuste,
  onRejeitar,
  onCancelar,
}: FeriasRequestCardProps) {
  const {
    id,
    tipo,
    userId,
    solicitantePapel,
    funcionarioNome,
    cicloFerias,
    avatarUrl,
    iniciais,
    dias,
    diasVendidos,
    inicio,
    periodo,
    dataSolicitacao,
    diasRestantes,
    diasTotais,
    status,
    origem,
    aprovadoGestorNome,
    aprovadoGestorEm,
    aprovadoDpNome,
    decididoEm,
    motivoRejeicao,
    canceladoNome,
    motivoCancelamento,
    periodoSugerido,
    motivoAjuste,
  } = solicitacao

  // Período de férias como range para o calendário (somente visualização).
  const inicioFerias = parseISO(inicio)
  const fimFerias = addDays(inicioFerias, Math.max(dias - 1, 0))

  const [rejeicaoAberta, setRejeicaoAberta] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [cancelamentoAberto, setCancelamentoAberto] = useState(false)
  const [motivoCancel, setMotivoCancel] = useState('')
  const [aceitandoAjuste, setAceitandoAjuste] = useState(false)

  function confirmarRejeicao() {
    onRejeitar?.(id, motivo.trim())
    setMotivo('')
    setRejeicaoAberta(false)
  }
  function confirmarCancelamento() {
    onCancelar?.(id, motivoCancel.trim() || null)
    setMotivoCancel('')
    setCancelamentoAberto(false)
  }
  async function aceitarAjuste() {
    setAceitandoAjuste(true)
    try {
      await onAceitarAjuste?.(id)
    } finally {
      setAceitandoAjuste(false)
    }
  }

  // Ninguém decide sobre a própria solicitação (a de si mesmo é gerida na aba
  // Pessoal — cancelar). Some com as ações no card da Visão geral. Exceção:
  // aceitar o ajuste do DP é sempre uma ação do próprio dono.
  const ehProprio = usuarioLogadoId !== undefined && userId === usuarioLogadoId

  const podeAprovarGestor =
    !ehProprio && status === 'PENDENTE' && papel === 'GESTOR'
  const podeConfirmarDp =
    !ehProprio && status === 'AGUARDANDO_DP' && ehConfirmador(papel, solicitantePapel)
  // Alternativa à confirmação: em vez de confirmar direto, o DP devolve uma
  // sugestão de nova data (mesma elegibilidade de podeConfirmarDp).
  const podeSugerirAjuste = podeConfirmarDp
  const podeAceitarAjuste = ehProprio && status === 'AJUSTE_SUGERIDO'
  const podeCancelarDp =
    !ehProprio &&
    status === 'APROVADA' &&
    (papel === PAPEL_COORD_DP || papel === PAPEL_RH)
  const temAcao =
    podeAprovarGestor || podeConfirmarDp || podeCancelarDp || podeAceitarAjuste

  // Aprovado só quando há um gestor que aprovou. Se passou de PENDENTE sem
  // gestor (fallback/setor sem gestor), a etapa foi dispensada — nesse caso a
  // linha do Gestor nem aparece (ver JSX abaixo), em vez de mostrar um
  // placeholder "dispensada".
  const estadoGestor: EstadoEtapa = aprovadoGestorNome
    ? 'feito'
    : status === 'AGUARDANDO_DP' || status === 'APROVADA'
      ? 'dispensado'
      : 'pendente'

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div className="flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className={STATUS_CONFIG[status].className}>
              {STATUS_CONFIG[status].label}
            </Badge>
            <Badge variant="outline" className="gap-1 font-normal text-gray-600 dark:text-gray-400">
              {tipo === 'FOLGA' ? (
                <Coffee className="h-3 w-3" />
              ) : (
                <Palmtree className="h-3 w-3" />
              )}
              {tipo === 'FOLGA' ? 'Folga' : 'Férias'}
            </Badge>
            {origem === 'REGISTRO_MANUAL' && (
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                Lançado manualmente
              </Badge>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="group -ml-1 flex items-center gap-1 rounded-md px-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Ver período d${tipo === 'FOLGA' ? 'a folga' : 'as férias'} no calendário`}
              >
                <CalendarDays className="h-3 w-3" />
                <span className="group-hover:underline">
                  {dias} dias • {periodo}
                  {diasVendidos > 0 ? ` • +${diasVendidos} vendidos` : ''}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="range"
                selected={{ from: inicioFerias, to: fimFerias }}
                onSelect={() => {}}
                defaultMonth={inicioFerias}
                locale={ptBR}
                className="rounded-lg [&_[role=gridcell]]:cursor-default"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Solicitado em
          </span>
          <span className="text-xs font-medium">{dataSolicitacao}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10 rounded-md">
              <AvatarImage src={avatarUrl} alt={funcionarioNome} className="rounded-md object-cover" />
              <AvatarFallback className="rounded-md bg-muted text-xs font-semibold">
                {iniciais}
              </AvatarFallback>
            </Avatar>
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm font-medium leading-none">{funcionarioNome}</span>
              <span className="truncate text-xs text-muted-foreground">Ciclo {cicloFerias}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="block text-xs text-muted-foreground">Dias restantes</span>
            <span className="text-sm font-semibold">
              {diasRestantes}/{diasTotais}
            </span>
          </div>
        </div>

        {/* Progresso de aprovação (gestor → DP). Sem gestor no setor, a
            etapa foi dispensada — a linha nem aparece. */}
        {status !== 'CANCELADA' && (
          <div className="flex flex-col gap-1">
            {estadoGestor !== 'dispensado' && (
              <EtapaProgresso
                rotulo="Gestor"
                nome={aprovadoGestorNome}
                em={aprovadoGestorEm}
                estado={estadoGestor}
              />
            )}
            <EtapaProgresso
              rotulo="DP"
              nome={aprovadoDpNome}
              em={decididoEm}
              estado={status === 'APROVADA' ? 'feito' : 'pendente'}
            />
          </div>
        )}

        {status === 'AJUSTE_SUGERIDO' && (
          <p className="rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
            <span className="font-medium">DP sugeriu ajuste:</span> de {periodo} para{' '}
            {periodoSugerido}.{motivoAjuste ? ` Motivo: ${motivoAjuste}.` : ''}
          </p>
        )}

        {status === 'REJEITADA' && motivoRejeicao && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
            <span className="font-medium">Motivo da recusa:</span> {motivoRejeicao}
          </p>
        )}
        {status === 'CANCELADA' && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Cancelado{canceladoNome ? ` por ${canceladoNome}` : ''}
            {motivoCancelamento ? ` — ${motivoCancelamento}` : ''}.
          </p>
        )}
      </CardContent>

      {temAcao && (
        <CardFooter className="justify-end gap-2 pt-0">
          {/* Rejeitar (gestor em PENDENTE, ou DP em AGUARDANDO_DP) */}
          {(podeAprovarGestor || podeConfirmarDp) && (
            <Dialog open={rejeicaoAberta} onOpenChange={setRejeicaoAberta}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-300 text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  Rejeitar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rejeitar solicitação</DialogTitle>
                  <DialogDescription>
                    Justifique a rejeição das férias de {funcionarioNome}. A justificativa
                    será registrada na solicitação.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo da rejeição…"
                  className="min-h-28"
                  autoFocus
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" size="sm">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button
                    size="sm"
                    onClick={confirmarRejeicao}
                    disabled={motivo.trim().length === 0}
                    className="border border-red-300 bg-red-600 text-white transition-colors hover:bg-red-700 dark:border-red-900/60 dark:bg-red-600 dark:text-white dark:hover:bg-red-500"
                  >
                    Confirmar rejeição
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {podeAprovarGestor && (
            <Button
              size="sm"
              onClick={() => onAprovar?.(id)}
              className="bg-green-600 text-white transition-colors hover:bg-green-700 dark:bg-green-600 dark:text-white dark:hover:bg-green-500"
            >
              Aprovar
            </Button>
          )}
          {podeConfirmarDp && (
            <Button
              size="sm"
              onClick={() => onConfirmar?.(id)}
              className="bg-blue-600 text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
            >
              Confirmar
            </Button>
          )}

          {/* Sugerir ajuste (alternativa à confirmação — DP devolve uma nova data) */}
          {podeSugerirAjuste && (
            <SugerirAjusteDialog
              id={id}
              funcionarioNome={funcionarioNome}
              periodo={periodo}
              inicioFerias={inicioFerias}
              dias={dias}
              onSugerirAjuste={onSugerirAjuste}
            />
          )}

          {/* Aceitar ajuste (sempre o próprio dono) */}
          {podeAceitarAjuste && (
            <Button
              size="sm"
              disabled={aceitandoAjuste}
              onClick={aceitarAjuste}
              className="bg-orange-600 text-white transition-colors hover:bg-orange-700 dark:bg-orange-600 dark:text-white dark:hover:bg-orange-500"
            >
              {aceitandoAjuste ? 'Aceitando…' : 'OK, aceitar novo período'}
            </Button>
          )}

          {/* Cancelar (DP, sobre uma aprovada) */}
          {podeCancelarDp && (
            <Dialog open={cancelamentoAberto} onOpenChange={setCancelamentoAberto}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Cancelar férias
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar férias</DialogTitle>
                  <DialogDescription>
                    Cancelar as férias já aprovadas de {funcionarioNome}. Você pode
                    registrar um motivo (opcional).
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  value={motivoCancel}
                  onChange={(e) => setMotivoCancel(e.target.value)}
                  placeholder="Motivo do cancelamento (opcional)…"
                  className="min-h-24"
                />
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" size="sm">
                      Voltar
                    </Button>
                  </DialogClose>
                  <Button size="sm" variant="destructive" onClick={confirmarCancelamento}>
                    Cancelar férias
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
