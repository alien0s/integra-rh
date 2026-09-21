import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { comunicacaoService } from '../services'
import type { Comunicado } from '../types'

/** Formata "2026-09-15" (ou com timestamp) pra "15/09/2026". */
function formatarData(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

interface AnunciosAgendadosDialogProps {
  /** Chamado depois de cancelar um agendado. */
  onRemovido?: () => void
}

/** Dialog com comunicados já aprovados, mas que ainda não chegaram na data_inicio. */
export function AnunciosAgendadosDialog({ onRemovido }: AnunciosAgendadosDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [agendados, setAgendados] = useState<Comunicado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [removendo, setRemovendo] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setAgendados(await comunicacaoService.listarAgendados())
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao buscar os anúncios agendados.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (aberto) carregar()
  }, [aberto, carregar])

  async function handleCancelar(comunicado: Comunicado) {
    setRemovendo(comunicado.id)
    try {
      await comunicacaoService.remover(comunicado.id)
      setAgendados((atual) => atual.filter((c) => c.id !== comunicado.id))
      onRemovido?.()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao cancelar o agendamento.')
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock className="mr-2 h-4 w-4" />
          Anúncios agendados
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Anúncios agendados</DialogTitle>
          <DialogDescription>
            Já aprovados, mas ainda aguardando a data de início chegar.
          </DialogDescription>
        </DialogHeader>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : agendados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anúncio agendado no momento.</p>
          ) : (
            agendados.map((comunicado) => (
              <div
                key={comunicado.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-medium leading-none">
                    {comunicado.titulo}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Começa em {formatarData(comunicado.dataInicio!)} · até{' '}
                    {formatarData(comunicado.dataFim!)}
                  </span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={removendo === comunicado.id}
                  onClick={() => handleCancelar(comunicado)}
                  title="Cancelar agendamento"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
