import { useState } from 'react'
import { CalendarRange } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { feriasService } from '@/features/ferias/services'
import type { SolicitacaoFerias } from '@/features/ferias/types'

/**
 * Dialog do GESTOR: lista as férias da equipe (em andamento e confirmadas)
 * ordenadas por início, para enxergar conflitos antes de aprovar novas.
 */
export function EquipeCalendarDialog() {
  const [aberto, setAberto] = useState(false)
  const [equipe, setEquipe] = useState<SolicitacaoFerias[]>([])
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function abrir(open: boolean) {
    setAberto(open)
    if (!open) return
    setCarregando(true)
    setErro(null)
    try {
      setEquipe(await feriasService.getEquipe())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar a equipe.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarRange className="h-4 w-4" />
          Calendário da equipe
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Férias da equipe</DialogTitle>
          <DialogDescription>
            Períodos em andamento e confirmados do seu setor — para evitar conflitos.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Carregando…</p>
        ) : erro ? (
          <p className="py-8 text-center text-sm text-destructive">{erro}</p>
        ) : equipe.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma férias agendada na equipe.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {equipe.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
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
                <Badge
                  variant="secondary"
                  className={
                    s.status === 'APROVADA'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                  }
                >
                  {s.status === 'APROVADA' ? 'Confirmado' : 'Aguardando DP'}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
