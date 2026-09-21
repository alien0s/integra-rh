import { useCallback, useEffect, useState } from 'react'
import { CircleCheckBig } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

/** Formata a data (venha como "2026-09-15" ou com hora/timestamp) pra "15/09/2026". */
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

/** Card de fila de aprovação do RH: comunicados aguardando decisão. */
export function ComunicadosPendentesCard() {
  const [pendentes, setPendentes] = useState<Comunicado[]>([])
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<number | null>(null)
  const [rejeitando, setRejeitando] = useState<Comunicado | null>(null)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setPendentes(await comunicacaoService.listarPendentes())
    } catch (error) {
      console.error('Erro ao buscar comunicados pendentes', error)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function handleAprovar(comunicado: Comunicado) {
    setProcessando(comunicado.id)
    try {
      await comunicacaoService.aprovar(comunicado.id)
      setPendentes((atual) => atual.filter((c) => c.id !== comunicado.id))
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao aprovar.')
    } finally {
      setProcessando(null)
    }
  }

  async function handleConfirmarRejeicao() {
    if (!rejeitando) return
    setProcessando(rejeitando.id)
    try {
      await comunicacaoService.rejeitar(rejeitando.id, motivo)
      setPendentes((atual) => atual.filter((c) => c.id !== rejeitando.id))
      setRejeitando(null)
      setMotivo('')
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao rejeitar.')
    } finally {
      setProcessando(null)
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400">
          <CircleCheckBig className="h-5 w-5" />
        </div>
        <CardTitle className="text-lg">
          Aprovações pendentes {pendentes.length > 0 && `(${pendentes.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-2">
        {erro && <p className="text-sm text-destructive">{erro}</p>}

        {carregando ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comunicado aguardando aprovação.</p>
        ) : (
          pendentes.map((comunicado) => (
            <div key={comunicado.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium leading-snug">{comunicado.titulo}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatarPeriodo(comunicado)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{comunicado.descricao}</p>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={processando === comunicado.id}
                  onClick={() => setRejeitando(comunicado)}
                >
                  Rejeitar
                </Button>
                <Button
                  size="sm"
                  disabled={processando === comunicado.id}
                  onClick={() => handleAprovar(comunicado)}
                >
                  {processando === comunicado.id ? 'Aprovando...' : 'Aprovar'}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog
        open={rejeitando !== null}
        onOpenChange={(valor) => {
          if (!valor) {
            setRejeitando(null)
            setMotivo('')
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar comunicado</DialogTitle>
            <DialogDescription>
              Explique o motivo — o criador vai ver essa justificativa.
            </DialogDescription>
          </DialogHeader>

          <textarea
            className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da rejeição"
            required
          />

          <DialogFooter>
            <Button
              variant="destructive"
              disabled={!motivo.trim() || processando === rejeitando?.id}
              onClick={handleConfirmarRejeicao}
            >
              {processando === rejeitando?.id ? 'Rejeitando...' : 'Confirmar rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
