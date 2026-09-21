import { useState } from 'react'
import { ptBR } from 'date-fns/locale'
import { Plus } from 'lucide-react'

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

import type { CriarVrMesInput } from '@/features/vr/types'

interface NovoVrMesDialogProps {
  onCriar: (input: CriarVrMesInput) => Promise<void>
  /** Mês ainda aberto, se existir — desabilita o botão até ele ser fechado. */
  mesAbertoExistente?: { mes: number; ano: number }
}

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** "2026-11-21" a partir de um Date, sem deslocamento de fuso (usa campos locais). */
function paraIsoLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Dialog "Novo mês": campos (mês, ano, valores) à esquerda, um embaixo do
 * outro; calendário de dias elegíveis à direita.
 */
export function NovoVrMesDialog({ onCriar, mesAbertoExistente }: NovoVrMesDialogProps) {
  const hoje = new Date()
  const [aberto, setAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())
  const [valorDiario, setValorDiario] = useState('')
  const [valorDiarioAprendiz, setValorDiarioAprendiz] = useState('')
  const [diasSelecionados, setDiasSelecionados] = useState<Date[]>([])

  function limpar() {
    setMes(hoje.getMonth() + 1)
    setAno(hoje.getFullYear())
    setValorDiario('')
    setValorDiarioAprendiz('')
    setDiasSelecionados([])
    setErro(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErro(null)

    if (diasSelecionados.length === 0) {
      setErro('Marque pelo menos 1 dia elegível no calendário.')
      return
    }

    setEnviando(true)
    try {
      await onCriar({
        mes,
        ano,
        valorDiario: Number(valorDiario),
        valorDiarioAprendiz: Number(valorDiarioAprendiz),
        diasElegiveis: diasSelecionados.map(paraIsoLocal),
      })
      setAberto(false)
      limpar()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao cadastrar o mês.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog
      open={aberto}
      onOpenChange={(valor) => {
        setAberto(valor)
        if (!valor) limpar()
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={Boolean(mesAbertoExistente)}
          title={
            mesAbertoExistente
              ? `Feche todas as entidades de ${mesAbertoExistente.mes}/${mesAbertoExistente.ano} antes de cadastrar outro mês`
              : undefined
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo mês
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cadastrar mês de VR</DialogTitle>
          <DialogDescription>
            Defina os valores diários e marque no calendário os dias elegíveis ao benefício.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Coluna esquerda: campos, um embaixo do outro */}
            <div className="flex w-full flex-col gap-3 sm:w-52 sm:shrink-0">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vr-mes">Mês</Label>
                <select
                  id="vr-mes"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value))}
                >
                  {MESES_LABEL.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vr-ano">Ano</Label>
                <Input
                  id="vr-ano"
                  type="number"
                  value={ano}
                  onChange={(e) => setAno(Number(e.target.value))}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vr-valor">Valor diário (R$)</Label>
                <Input
                  id="vr-valor"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="35.00"
                  value={valorDiario}
                  onChange={(e) => setValorDiario(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="vr-valor-aprendiz">Valor diário Aprendiz/Estagiário (R$)</Label>
                <Input
                  id="vr-valor-aprendiz"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="25.00"
                  value={valorDiarioAprendiz}
                  onChange={(e) => setValorDiarioAprendiz(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Coluna direita: calendário */}
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Dias elegíveis ({diasSelecionados.length} marcado(s))</Label>
              <div className="flex justify-center rounded-md border">
                <Calendar
                  mode="multiple"
                  locale={ptBR}
                  selected={diasSelecionados}
                  onSelect={(dias) => setDiasSelecionados(dias ?? [])}
                  month={new Date(ano, mes - 1)}
                  onMonthChange={(data) => {
                    setMes(data.getMonth() + 1)
                    setAno(data.getFullYear())
                  }}
                />
              </div>
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={enviando || diasSelecionados.length === 0}>
              {enviando ? 'Salvando...' : 'Cadastrar mês'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
