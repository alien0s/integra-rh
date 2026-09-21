import { useMemo, useRef, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type {
  SolicitacaoFerias,
  StatusSolicitacaoFerias,
} from '@/features/ferias/types'

/** Largura de cada coluna de dia (px) e da coluna fixa das pessoas. */
const DIA_W = 40
const ESQ_W = 200

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/** Cor da barra por status (identidade do app, não do anexo). */
const COR_BARRA: Record<StatusSolicitacaoFerias, string> = {
  PENDENTE: 'bg-amber-400 text-amber-950 dark:bg-amber-500/80 dark:text-amber-50',
  AGUARDANDO_DP: 'bg-blue-500 text-white',
  AJUSTE_SUGERIDO: 'bg-orange-500 text-white',
  APROVADA: 'bg-emerald-500 text-white',
  REJEITADA: 'bg-red-400 text-white',
  CANCELADA: 'bg-muted-foreground/40 text-foreground',
}

/** "YYYY-MM-DD" → Date local (meia-noite, sem susto de fuso). */
function dataLocal(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}
/** Dias corridos entre duas datas (b - a), inteiros. */
function diffDias(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}
/** "dd/MM" curto para a barra. */
function ddmm(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface Linha {
  userId: string
  nome: string
  iniciais: string
  avatarUrl: string
  ciclo: string
  itens: SolicitacaoFerias[]
}

interface FeriasTimelineProps {
  solicitacoes: SolicitacaoFerias[]
}

/**
 * Visualização em "linha do tempo" (calendário em lista) das requisições de
 * férias: uma linha por colaborador e barras coloridas (por status) no período
 * solicitado, sobre uma régua de dias com marcador de "Hoje". Rola na horizontal
 * quando o intervalo é grande. Inspirado no layout de gantt, adaptado ao shadcn.
 */
export function FeriasTimeline({ solicitacoes }: FeriasTimelineProps) {
  const hoje = useMemo(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const { dias, linhas, inicioJanela, offsetHoje } = useMemo(() => {
    if (solicitacoes.length === 0) {
      return { dias: [] as Date[], linhas: [] as Linha[], inicioJanela: hoje, offsetHoje: -1 }
    }

    // Agrupa por colaborador (uma linha, possivelmente várias barras).
    const porUser = new Map<string, Linha>()
    for (const s of solicitacoes) {
      const linha = porUser.get(s.userId) ?? {
        userId: s.userId,
        nome: s.funcionarioNome,
        iniciais: s.iniciais,
        avatarUrl: s.avatarUrl,
        ciclo: s.cicloFerias,
        itens: [],
      }
      linha.itens.push(s)
      porUser.set(s.userId, linha)
    }
    const linhas = [...porUser.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, 'pt-BR'),
    )

    // Janela: do menor início ao maior fim das SOLICITAÇÕES (não força hoje),
    // com uma folga de 1 dia de cada lado.
    let min = dataLocal(solicitacoes[0].inicio)
    let max = min
    for (const s of solicitacoes) {
      const ini = dataLocal(s.inicio)
      const fim = new Date(ini)
      fim.setDate(fim.getDate() + Math.max(s.dias - 1, 0))
      if (ini < min) min = ini
      if (fim > max) max = fim
    }
    const inicioJanela = new Date(min)
    inicioJanela.setDate(inicioJanela.getDate() - 1)
    const fimJanela = new Date(max)
    fimJanela.setDate(fimJanela.getDate() + 1)

    const total = diffDias(inicioJanela, fimJanela) + 1
    const dias = Array.from({ length: total }, (_, i) => {
      const d = new Date(inicioJanela)
      d.setDate(d.getDate() + i)
      return d
    })

    return {
      dias,
      linhas,
      inicioJanela,
      offsetHoje: diffDias(inicioJanela, hoje),
    }
  }, [solicitacoes, hoje])

  // Índice do dia visível na borda esquerda da régua — controla o mês do card
  // ao rolar horizontalmente.
  const scrollRef = useRef<HTMLDivElement>(null)
  const [idxVisivel, setIdxVisivel] = useState(0)

  function handleScroll() {
    const el = scrollRef.current
    if (!el || dias.length === 0) return
    const i = Math.min(
      dias.length - 1,
      Math.max(0, Math.round(el.scrollLeft / DIA_W)),
    )
    setIdxVisivel(i)
  }

  if (solicitacoes.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Nenhuma solicitação encontrada.
      </div>
    )
  }

  const larguraTrilha = dias.length * DIA_W
  const dentroDaJanela = offsetHoje >= 0 && offsetHoje < dias.length
  // Mês exibido no card = do dia visível na esquerda (ou início da janela).
  const diaCabecalho = dias[Math.min(idxVisivel, dias.length - 1)] ?? inicioJanela

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className="scrollbar-thin overflow-x-auto rounded-lg border"
    >
      <div style={{ width: ESQ_W + larguraTrilha }}>
        {/* Cabeçalho: coluna fixa (mês) + régua de dias */}
        <div className="flex border-b bg-muted/30">
          <div
            className="sticky left-0 z-30 flex items-center border-r bg-background px-4 text-sm font-semibold capitalize"
            style={{ width: ESQ_W }}
          >
            {MESES[diaCabecalho.getMonth()]} {diaCabecalho.getFullYear()}
          </div>
          <div className="flex">
            {dias.map((d, i) => {
              const fds = d.getDay() === 0 || d.getDay() === 6
              const ehHoje = i === offsetHoje
              return (
                <div
                  key={i}
                  className={`flex flex-col items-center justify-center py-1.5 text-[10px] ${
                    fds ? 'bg-muted/50' : ''
                  } ${ehHoje ? 'bg-primary/10' : ''}`}
                  style={{ width: DIA_W }}
                >
                  <span
                    className={
                      ehHoje ? 'font-medium text-primary' : 'text-muted-foreground'
                    }
                  >
                    {DIAS_SEMANA[d.getDay()]}
                  </span>
                  <span
                    className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      ehHoje
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Linhas: uma por colaborador */}
        {linhas.map((linha) => (
          <div key={linha.userId} className="flex border-b last:border-b-0">
            {/* Coluna fixa: colaborador (acima das barras ao rolar) */}
            <div
              className="sticky left-0 z-30 flex items-center gap-2 border-r bg-background px-4 py-2"
              style={{ width: ESQ_W }}
            >
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarImage
                  src={linha.avatarUrl}
                  alt={linha.nome}
                  className="rounded-md object-cover"
                />
                <AvatarFallback className="rounded-md bg-muted text-[10px] font-semibold">
                  {linha.iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium leading-tight">
                  {linha.nome}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Ciclo {linha.ciclo}
                </p>
              </div>
            </div>

            {/* Trilha: fundo de fim de semana + marcador de hoje + barras */}
            <div
              className="relative"
              style={{ width: larguraTrilha, minHeight: 52 }}
            >
              {/* colunas de fim de semana (fundo) */}
              {dias.map((d, i) =>
                d.getDay() === 0 || d.getDay() === 6 ? (
                  <div
                    key={i}
                    className="absolute inset-y-0 bg-muted/30"
                    style={{ left: i * DIA_W, width: DIA_W }}
                  />
                ) : null,
              )}
              {/* marcador de hoje */}
              {dentroDaJanela ? (
                <div
                  className="absolute inset-y-0 z-10 w-px bg-primary/60"
                  style={{ left: offsetHoje * DIA_W + DIA_W / 2 }}
                />
              ) : null}

              {/* barras do colaborador */}
              {linha.itens.map((s) => {
                const ini = dataLocal(s.inicio)
                const fim = new Date(ini)
                fim.setDate(fim.getDate() + Math.max(s.dias - 1, 0))
                const offset = diffDias(inicioJanela, ini)
                const largura = Math.max(s.dias, 1) * DIA_W
                const cabeRange = largura >= 96
                return (
                  <div
                    key={s.id}
                    title={`${s.periodo} • ${s.dias} dias`}
                    className={`absolute z-20 flex items-center justify-between gap-2 overflow-hidden rounded-full px-3 text-xs font-medium shadow-sm ${COR_BARRA[s.status]}`}
                    style={{
                      left: offset * DIA_W + 3,
                      width: largura - 6,
                      top: 10,
                      height: 32,
                    }}
                  >
                    {cabeRange ? (
                      <span className="truncate">
                        {ddmm(ini)}–{ddmm(fim)}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="shrink-0 opacity-90">{s.dias}d</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
