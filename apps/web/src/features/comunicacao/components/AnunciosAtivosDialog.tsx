import { useCallback, useEffect, useState } from 'react'
import { ListChecks, Trash2 } from 'lucide-react'

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
import type { Comunicado, DiaSemana } from '../types'

const DIAS_SEMANA_LABEL: Record<DiaSemana, string> = {
  0: 'todo domingo',
  1: 'toda segunda-feira',
  2: 'toda terça-feira',
  3: 'toda quarta-feira',
  4: 'toda quinta-feira',
  5: 'toda sexta-feira',
  6: 'todo sábado',
}

/** Formata "2026-09-15" (ou com timestamp) pra "15/09/2026". */
function formatarData(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/** Texto do período: datas pro não-recorrente, ou "toda [dia]" pro recorrente. */
function formatarPeriodo(comunicado: Comunicado): string {
  if (comunicado.recorrente && comunicado.diaSemana !== null) {
    return DIAS_SEMANA_LABEL[comunicado.diaSemana]
  }
  if (comunicado.dataInicio && comunicado.dataFim) {
    return `${formatarData(comunicado.dataInicio)} – ${formatarData(comunicado.dataFim)}`
  }
  return ''
}

interface AnunciosAtivosDialogProps {
  /** Chamado depois de remover um comunicado (ex.: recarregar o mural da Home). */
  onRemovido?: () => void
}

/** Dialog com todos os comunicados ativos no momento, com período e opção de remover (RH). */
export function AnunciosAtivosDialog({ onRemovido }: AnunciosAtivosDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [ativos, setAtivos] = useState<Comunicado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [removendo, setRemovendo] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setAtivos(await comunicacaoService.listarAtivos())
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao buscar os anúncios ativos.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (aberto) carregar()
  }, [aberto, carregar])

  async function handleRemover(comunicado: Comunicado) {
    setRemovendo(comunicado.id)
    try {
      await comunicacaoService.remover(comunicado.id)
      setAtivos((atual) => atual.filter((c) => c.id !== comunicado.id))
      onRemovido?.()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao remover o anúncio.')
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <ListChecks className="mr-2 h-4 w-4" />
          Anúncios ativos
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Anúncios ativos</DialogTitle>
          <DialogDescription>Comunicados no ar agora, com o período de vigência.</DialogDescription>
        </DialogHeader>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : ativos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anúncio ativo no momento.</p>
          ) : (
            ativos.map((comunicado) => (
              <div
                key={comunicado.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="grid min-w-0 gap-0.5">
                  <span className="truncate text-sm font-medium leading-none">
                    {comunicado.titulo}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatarPeriodo(comunicado)}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={removendo === comunicado.id}
                  onClick={() => handleRemover(comunicado)}
                  title="Remover do ar"
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
