import { useEffect, useState } from 'react'
import { ptBR } from 'date-fns/locale'
import { Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { vrService } from '@/features/vr/services'
import type { VrMes } from '@/features/vr/types'

interface EditarVrMesDialogProps {
  vrMes: VrMes
  onEditado: () => Promise<void>
}

/** "2026-11-21" a partir de um Date, sem deslocamento de fuso. */
function paraIsoLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** "2026-11-21" -> Date local (sem deslocamento de fuso, ao contrário de new Date(iso)). */
function deIsoLocal(iso: string): Date {
  const [ano, mes, dia] = iso.split('-').map(Number)
  return new Date(ano, mes - 1, dia)
}

/**
 * Dialog "Editar mês": ajusta os valores diários e o calendário de dias
 * elegíveis de um mês já cadastrado. Só é chamado enquanto o mês está
 * aberto (o botão que abre isso já não aparece pra meses fechados).
 */
export function EditarVrMesDialog({ vrMes, onEditado }: EditarVrMesDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [valorDiario, setValorDiario] = useState('')
  const [valorDiarioAprendiz, setValorDiarioAprendiz] = useState('')
  const [diasSelecionados, setDiasSelecionados] = useState<Date[]>([])

  useEffect(() => {
    if (!aberto) return
    setCarregando(true)
    setErro(null)
    vrService
      .getDetalhe(vrMes.id)
      .then((detalhe) => {
        setValorDiario(String(detalhe.valorDiario))
        setValorDiarioAprendiz(String(detalhe.valorDiarioAprendiz))
        setDiasSelecionados(detalhe.diasElegiveisDatas.map(deIsoLocal))
      })
      .catch((error) => setErro(error instanceof Error ? error.message : 'Falha ao carregar.'))
      .finally(() => setCarregando(false))
  }, [aberto, vrMes.id])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErro(null)

    if (diasSelecionados.length === 0) {
      setErro('Marque pelo menos 1 dia elegível no calendário.')
      return
    }

    setEnviando(true)
    try {
      await vrService.editar(vrMes.id, {
        valorDiario: Number(valorDiario),
        valorDiarioAprendiz: Number(valorDiarioAprendiz),
        diasElegiveis: diasSelecionados.map(paraIsoLocal),
      })
      await onEditado()
      setAberto(false)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao salvar as alterações.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-6 w-6" title="Editar mês">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Editar mês — {vrMes.mes}/{vrMes.ano}
          </DialogTitle>
          <DialogDescription>
            Ajuste os valores diários e os dias elegíveis.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editar-vr-valor">Valor diário (R$)</Label>
                <Input
                  id="editar-vr-valor"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorDiario}
                  onChange={(e) => setValorDiario(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="editar-vr-valor-aprendiz">Aprendiz/Estagiário (R$)</Label>
                <Input
                  id="editar-vr-valor-aprendiz"
                  type="number"
                  step="0.01"
                  min="0"
                  value={valorDiarioAprendiz}
                  onChange={(e) => setValorDiarioAprendiz(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Dias elegíveis ({diasSelecionados.length} marcado(s))</Label>
              <div className="flex justify-center rounded-md border">
                <Calendar
                  mode="multiple"
                  locale={ptBR}
                  selected={diasSelecionados}
                  onSelect={(dias) => setDiasSelecionados(dias ?? [])}
                  defaultMonth={new Date(vrMes.ano, vrMes.mes - 1)}
                />
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <DialogFooter>
              <Button type="submit" disabled={enviando || diasSelecionados.length === 0}>
                {enviando ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
