import { useEffect, useState } from 'react'
import { CalendarClock, PlaneTakeoff } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { feriasService } from '@/features/ferias/services'
import type { VisaoGeralFerias } from '@/features/ferias/types'

/**
 * Diálogo (DP/RH) com a visão geral do ciclo: quem vai entrar de férias
 * (filtrável por mês) e quem precisa tirar (ciclo aquisitivo perto de
 * fechar sem pedido). Antes era um painel sempre visível no topo da Visão
 * geral de Férias — virou diálogo pra não ocupar espaço da tela o tempo
 * todo; os dados só são buscados quando o diálogo é aberto.
 */
export function VisaoGeralDpRhDialog() {
  const [aberto, setAberto] = useState(false)
  const [mes, setMes] = useState('') // YYYY-MM (vazio = a partir de hoje)
  const [dados, setDados] = useState<VisaoGeralFerias | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return

    let ativo = true
    setCarregando(true)
    setErro(null)
    feriasService
      .getGeral(mes || undefined)
      .then((d) => ativo && setDados(d))
      .catch((e) => ativo && setErro(e instanceof Error ? e.message : 'Falha ao carregar.'))
      .finally(() => ativo && setCarregando(false))
    return () => {
      ativo = false
    }
  }, [aberto, mes])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PlaneTakeoff className="h-4 w-4" />
          Visão geral do ciclo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Visão geral do ciclo</DialogTitle>
          <DialogDescription>
            Quem vai entrar de férias e quem precisa tirar (ciclo aquisitivo perto de
            fechar sem pedido).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="filtro-mes" className="text-xs text-muted-foreground">
                Filtrar "vão entrar" por mês
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="filtro-mes"
                  type="month"
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="h-9 w-44"
                />
                {mes && (
                  <button
                    type="button"
                    onClick={() => setMes('')}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          {erro ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-destructive">
              {erro}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Vão entrar de férias */}
              <Card className="shadow-none">
                <CardHeader className="flex flex-row items-center gap-2 pb-3">
                  <PlaneTakeoff className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <CardTitle className="text-base">
                    Vão entrar de férias{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({dados?.vaoEntrar.length ?? 0})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {carregando ? (
                    <p className="px-6 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
                  ) : (dados?.vaoEntrar.length ?? 0) === 0 ? (
                    <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Ninguém {mes ? 'nesse mês' : 'nos próximos dias'}.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {dados!.vaoEntrar.map((s) => (
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
                <CardHeader className="flex flex-row items-center gap-2 pb-3">
                  <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <CardTitle className="text-base">
                    Precisam tirar férias{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({dados?.precisamTirar.length ?? 0})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {carregando ? (
                    <p className="px-6 py-8 text-center text-sm text-muted-foreground">Carregando…</p>
                  ) : (dados?.precisamTirar.length ?? 0) === 0 ? (
                    <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                      Ninguém com ciclo perto de fechar.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {dados!.precisamTirar.map((c) => (
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
      </DialogContent>
    </Dialog>
  )
}
