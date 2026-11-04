import { useEffect, useMemo, useState } from 'react'
import { PartyPopper } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Aniversariante } from '../types'

interface AniversariantesCardProps {
  aniversariantes: Aniversariante[]
}

/** Troca o card inteiro pelo aniversariante x a lista a cada 7s (mesmo
 *  intervalo do autoplay do carrossel de comunicados, ComunicadosCarousel.tsx). */
const INTERVALO_REVEZAMENTO_MS = 7000

/** "Fulano da Silva Souza" → "Fulano Souza" (primeiro + último nome). */
function primeiroEUltimoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return partes.length <= 1 ? nome : `${partes[0]} ${partes[partes.length - 1]}`
}

/** "dd/mm" a partir do dia/mês (1-indexado). */
function formatarDiaMes(dia: number, mes: number): string {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`
}

interface PecaConfete {
  cor: string
  forma: 'circulo' | 'barra'
  /** Direção da explosão, em graus (0 = direita, 90 = baixo, 180 = esquerda, 270 = cima). */
  anguloGraus: number
  /** Distância do estouro a partir do centro (px) — o "raio" da explosão. */
  raioExplosao: number
  /** Atraso antes de começar (ms) — evita que todas as peças estourem juntas. */
  atraso: number
}

/**
 * 15 peças, ângulos e raios IRREGULARES de propósito (nada de progressão
 * geométrica tipo 0/30/60/90...) pra parecer bagunçado feito confete de
 * verdade, não um leque desenhado. Nenhuma entre 65°–115° (reto pra baixo,
 * ver anguloGraus): a explosão sai pra todo lado MENOS pra baixo — a queda
 * por gravidade (QUEDA_EXTRA_PX) já cuida de levar tudo pra baixo depois.
 * Fixo (não `Math.random()`) só pra não recalcular a cada render, mas os
 * valores em si já foram escolhidos pra não ter padrão óbvio.
 */
const PECAS_CONFETE: PecaConfete[] = [
  { cor: 'bg-pink-500', forma: 'circulo', anguloGraus: 350, raioExplosao: 62, atraso: 0 },
  { cor: 'bg-sky-500', forma: 'barra', anguloGraus: 20, raioExplosao: 71, atraso: 90 },
  { cor: 'bg-violet-500', forma: 'circulo', anguloGraus: 55, raioExplosao: 57, atraso: 40 },
  { cor: 'bg-amber-400', forma: 'barra', anguloGraus: 125, raioExplosao: 67, atraso: 150 },
  { cor: 'bg-emerald-400', forma: 'circulo', anguloGraus: 148, raioExplosao: 61, atraso: 10 },
  { cor: 'bg-pink-500', forma: 'barra', anguloGraus: 177, raioExplosao: 73, atraso: 170 },
  { cor: 'bg-sky-500', forma: 'circulo', anguloGraus: 198, raioExplosao: 54, atraso: 60 },
  { cor: 'bg-violet-500', forma: 'barra', anguloGraus: 226, raioExplosao: 69, atraso: 110 },
  { cor: 'bg-amber-400', forma: 'circulo', anguloGraus: 243, raioExplosao: 59, atraso: 20 },
  { cor: 'bg-emerald-400', forma: 'barra', anguloGraus: 266, raioExplosao: 76, atraso: 140 },
  { cor: 'bg-pink-500', forma: 'circulo', anguloGraus: 282, raioExplosao: 56, atraso: 75 },
  { cor: 'bg-sky-500', forma: 'barra', anguloGraus: 308, raioExplosao: 65, atraso: 50 },
  { cor: 'bg-violet-500', forma: 'circulo', anguloGraus: 326, raioExplosao: 60, atraso: 130 },
  { cor: 'bg-amber-400', forma: 'barra', anguloGraus: 341, raioExplosao: 70, atraso: 30 },
  { cor: 'bg-emerald-400', forma: 'circulo', anguloGraus: 8, raioExplosao: 55, atraso: 100 },
]

/** Volta a cair mais ~115px depois da explosão (gravidade) e deriva mais
 *  35% na mesma direção — mesmo pra quem estourou pra cima. */
const QUEDA_EXTRA_PX = 115
const DERIVA_EXTRA = 1.35

/**
 * Confete que EXPLODE a partir de trás da foto (nasce escondido, minúsculo,
 * no centro) e se espalha em círculo completo antes de cair — renderizado
 * ANTES do Avatar no DOM (que fica com `relative z-10`), então as peças
 * nascem "atrás" dela. A animação (`animate-confetti-fall`, ver index.css:
 * explosão 0%→30%, queda por gravidade 30%→100%) dura ~2.4s e reinicia
 * sozinha sempre que este componente é remontado — quem decide remontar é o
 * `key` no componente pai.
 */
function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {PECAS_CONFETE.map((peca, indice) => {
        const radianos = (peca.anguloGraus * Math.PI) / 180
        const x1 = Math.round(Math.cos(radianos) * peca.raioExplosao)
        const y1 = Math.round(Math.sin(radianos) * peca.raioExplosao)
        const x2 = Math.round(x1 * DERIVA_EXTRA)
        const y2 = y1 + QUEDA_EXTRA_PX
        const rotacaoFinal = 200 + indice * 35

        return (
          <span
            key={indice}
            className={cn(
              'absolute left-1/2 top-1/2 block animate-confetti-fall',
              peca.forma === 'circulo' ? 'h-2.5 w-2.5 rounded-full' : 'h-2 w-3.5 rounded-sm',
              peca.cor,
            )}
            style={
              {
                animationDelay: `${peca.atraso}ms`,
                '--confetti-x1': `${x1}px`,
                '--confetti-y1': `${y1}px`,
                '--confetti-x2': `${x2}px`,
                '--confetti-y2': `${y2}px`,
                '--confetti-r1': `${Math.round(rotacaoFinal / 2)}deg`,
                '--confetti-r2': `${rotacaoFinal}deg`,
              } as React.CSSProperties
            }
          />
        )
      })}
    </div>
  )
}

/** Elemento individual exibido quando é aniversário de alguém hoje — sem o
 *  título/ícone do card, só foto (com confete) + texto. */
function AniversarioHojeView({ pessoa }: { pessoa: Aniversariante }) {
  return (
    <div className="flex animate-in flex-col items-center gap-3 fade-in-0 text-center duration-500">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <Confetti />
        <Avatar className="relative z-10 h-20 w-20 rounded-lg ring-4 ring-background">
          <AvatarImage src={pessoa.fotoUrl} alt={pessoa.nome} className="rounded-lg" />
          <AvatarFallback className="rounded-lg text-lg font-semibold">
            {pessoa.iniciais}
          </AvatarFallback>
        </Avatar>
      </div>
      <p className="flex items-center gap-1.5 text-base font-medium">
        <img
          src="/emojis/star-struck-3d.png"
          alt="🤩"
          className="inline-block h-6 w-6 animate-emoji-bounce"
        />
        Hoje é aniversário de {primeiroEUltimoNome(pessoa.nome)}
      </p>
    </div>
  )
}

/**
 * Card com os aniversariantes do mês — lista em formato de tabela (nome à
 * esquerda, data "dd/mm" à direita). Altura fixa só a partir de `md:`
 * (`md:h-80`, igual à dos cards vizinhos da dashboard — ver AppsLinksCard e
 * FeriasStatusCard, mesma regra) — com scroll interno próprio quando a lista
 * não cabe nessa altura. No mobile (<md, empilhado em 1 coluna) a altura é
 * livre: forçar h-80 ali sobra espaço vazio (card com pouco conteúdo) ou
 * estoura (card com conteúdo demais sem o scroll ter altura fixa pra valer).
 *
 * Quando alguém faz aniversário HOJE, o card passa a revezar, a cada 7s,
 * entre essa lista e um elemento comemorativo individual (AniversarioHojeView,
 * com confete) — sem o título/ícone do card. O elemento individual abre
 * primeiro. Com mais de um aniversariante hoje, revezam entre si: pessoa A →
 * lista → pessoa B → lista → pessoa A → ... Pausa ao passar o mouse (mesma
 * UX do autoplay do carrossel de comunicados).
 */
export function AniversariantesCard({ aniversariantes }: AniversariantesCardProps) {
  const aniversariantesHoje = useMemo(() => {
    const hoje = new Date()
    return aniversariantes.filter(
      (pessoa) => pessoa.dia === hoje.getDate() && pessoa.mes === hoje.getMonth() + 1,
    )
  }, [aniversariantes])
  const temAniversarioHoje = aniversariantesHoje.length > 0

  const [tick, setTick] = useState(0)
  const [pausado, setPausado] = useState(false)

  useEffect(() => {
    if (!temAniversarioHoje || pausado) return
    const id = setInterval(() => setTick((t) => t + 1), INTERVALO_REVEZAMENTO_MS)
    return () => clearInterval(id)
  }, [temAniversarioHoje, pausado])

  // tick par = mostra uma pessoa (começa em 0 → abre nela primeiro);
  // ímpar = mostra a lista. Com N aniversariantes hoje, a pessoa muda a
  // cada 2 ticks, revezando entre eles.
  const mostrarPessoa = temAniversarioHoje && tick % 2 === 0
  const pessoaDoMomento = mostrarPessoa
    ? aniversariantesHoje[(tick / 2) % aniversariantesHoje.length]
    : null

  return (
    <Card
      className="flex flex-col shadow-none md:h-80"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      {!mostrarPessoa && (
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400">
            <PartyPopper className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Aniversariantes do mês</CardTitle>
        </CardHeader>
      )}
      <CardContent
        className={
          mostrarPessoa
            ? 'flex flex-1 items-center justify-center'
            : 'scrollbar-thin min-h-0 flex-1 overflow-y-auto pt-2'
        }
      >
        {pessoaDoMomento ? (
          <AniversarioHojeView key={tick} pessoa={pessoaDoMomento} />
        ) : aniversariantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém faz aniversário este mês.</p>
        ) : (
          <div className="divide-y">
            {aniversariantes.map((pessoa) => (
              <div
                key={pessoa.id}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-9 w-9 rounded-lg">
                    <AvatarImage src={pessoa.fotoUrl} alt={pessoa.nome} className="rounded-lg" />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                      {pessoa.iniciais}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium leading-none">
                    {primeiroEUltimoNome(pessoa.nome)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatarDiaMes(pessoa.dia, pessoa.mes)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
