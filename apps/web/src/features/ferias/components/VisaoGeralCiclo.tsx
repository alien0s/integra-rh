import { useEffect, useMemo, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, PlaneTakeoff } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { feriasService } from '@/features/ferias/services'
import type {
  ColaboradorPendenteFerias,
  SolicitacaoFerias,
  VisaoGeralFerias,
} from '@/features/ferias/types'

/** Um grupo de itens do mesmo mês, pra virar uma aba. */
interface GrupoMes<T> {
  /** Chave "YYYY-MM" — usada como `value` da aba e pra ordenar cronologicamente. */
  chave: string
  /** Rótulo curto da aba, ex.: "Nov/26". */
  rotulo: string
  itens: T[]
}

/** Rótulo curto de mês/ano pra aba, ex.: "Nov/26". */
function rotuloMes(data: Date): string {
  const rotulo = format(data, 'MMM/yy', { locale: ptBR })
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
}

/**
 * Agrupa itens por mês (a partir de `dataDe`), só com os meses que
 * realmente têm gente — nada de mês vazio aparecendo à toa. Ordenado do
 * mês mais próximo pro mais distante.
 */
function agruparPorMes<T>(itens: T[], dataDe: (item: T) => Date): GrupoMes<T>[] {
  const mapa = new Map<string, GrupoMes<T>>()
  for (const item of itens) {
    const data = dataDe(item)
    const chave = format(data, 'yyyy-MM')
    const grupo = mapa.get(chave) ?? { chave, rotulo: rotuloMes(data), itens: [] }
    grupo.itens.push(item)
    mapa.set(chave, grupo)
  }
  return [...mapa.values()].sort((a, b) => a.chave.localeCompare(b.chave))
}

/**
 * Visão geral do ciclo (DP/RH): quem vai entrar de férias e quem precisa
 * tirar (ciclo aquisitivo perto de fechar sem pedido). Sempre visível no
 * topo da aba "Visão geral" — antes vivia atrás de um botão/diálogo (ver
 * histórico de VisaoGeralDpRhDialog.tsx, removido), promovido pra cá pra
 * não exigir um clique extra pra ver essa informação.
 *
 * Busca tudo de uma vez (sem filtro de mês na API — o backend já devolve
 * todo mundo com data_inicio >= hoje) e agrupa por mês NO FRONT, em cada
 * card, com abas de clique direto (sem escolher data) — só aparecem os
 * meses que realmente têm gente (`agruparPorMes`).
 */
export function VisaoGeralCiclo() {
  const [dados, setDados] = useState<VisaoGeralFerias | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // Mês escolhido em cada card (null = ainda não escolheu, cai no mais próximo).
  const [mesEntrar, setMesEntrar] = useState<string | null>(null)
  const [mesTirar, setMesTirar] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    feriasService
      .getGeral()
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [])

  const hoje = useMemo(() => new Date(), [])

  const gruposEntrar = useMemo(
    () => agruparPorMes<SolicitacaoFerias>(dados?.vaoEntrar ?? [], (s) => parseISO(s.inicio)),
    [dados],
  )
  // "Precisam tirar" não tem uma data explícita — deriva o mês a partir de
  // diasParaFimDoCiclo (hoje + N dias ≈ quando o ciclo fecha).
  const gruposTirar = useMemo(
    () =>
      agruparPorMes<ColaboradorPendenteFerias>(dados?.precisamTirar ?? [], (c) =>
        addDays(hoje, c.diasParaFimDoCiclo),
      ),
    [dados, hoje],
  )

  const chaveEntrar = mesEntrar ?? gruposEntrar[0]?.chave ?? ''
  const chaveTirar = mesTirar ?? gruposTirar[0]?.chave ?? ''
  const itensEntrar = gruposEntrar.find((g) => g.chave === chaveEntrar)?.itens ?? []
  const itensTirar = gruposTirar.find((g) => g.chave === chaveTirar)?.itens ?? []

  return (
    <div className="flex flex-col gap-3">

      {erro ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-destructive">
          {erro}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Vão entrar de férias */}
          <Card className="shadow-none">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <PlaneTakeoff className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-base">
                  Vão entrar de férias{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({itensEntrar.length})
                  </span>
                </CardTitle>
              </div>
              {gruposEntrar.length > 1 && (
                <Tabs value={chaveEntrar} onValueChange={setMesEntrar}>
                  <TabsList className="h-8">
                    {gruposEntrar.map((g) => (
                      <TabsTrigger key={g.chave} value={g.chave} className="px-3 text-xs">
                        {g.rotulo}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : itensEntrar.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Ninguém agendado.
                </p>
              ) : (
                <ul className="divide-y">
                  {itensEntrar.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-6 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-md">
                          <AvatarImage src={s.avatarUrl} alt={s.funcionarioNome} className="rounded-md object-cover" />
                          <AvatarFallback className="rounded-md bg-muted text-xs font-semibold">
                            {s.iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{s.funcionarioNome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.dias} dias • {s.periodo}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Precisam tirar férias */}
          <Card className="shadow-none">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <CardTitle className="text-base">
                  Precisam tirar férias{' '}
                  <span className="text-sm font-normal text-muted-foreground">
                    ({itensTirar.length})
                  </span>
                </CardTitle>
              </div>
              {gruposTirar.length > 1 && (
                <Tabs value={chaveTirar} onValueChange={setMesTirar}>
                  <TabsList className="h-8">
                    {gruposTirar.map((g) => (
                      <TabsTrigger key={g.chave} value={g.chave} className="px-3 text-xs">
                        {g.rotulo}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {carregando ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
              ) : itensTirar.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                  Ninguém com ciclo perto de fechar.
                </p>
              ) : (
                <ul className="divide-y">
                  {itensTirar.map((c) => (
                    <li key={c.userId} className="flex items-center justify-between gap-3 px-6 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-md">
                          <AvatarImage src={c.avatarUrl} alt={c.nome} className="rounded-md object-cover" />
                          <AvatarFallback className="rounded-md bg-muted text-xs font-semibold">
                            {c.iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{c.nome}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.setor ?? 'Sem setor'} • ciclo fecha {c.cicloFim}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      >
                        {c.diasParaFimDoCiclo} dia(s)
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
