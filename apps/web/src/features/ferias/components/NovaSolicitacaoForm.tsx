import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { format, isWeekend } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

/** Formata uma data para exibição nos campos (dd/MM/yyyy). */
function formatarData(data?: Date): string {
  return data ? format(data, 'dd/MM/yyyy') : ''
}

/**
 * Formulário de nova solicitação de férias (calendário de período, abono e
 * observações). Estado local — a persistência será ligada à API depois.
 */
export function NovaSolicitacaoForm() {
  const [periodo, setPeriodo] = useState<DateRange | undefined>()
  const [abono, setAbono] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  const podeSolicitar = Boolean(periodo?.from && periodo?.to)

  /**
   * Aplica a seleção do calendário, bloqueando início em fim de semana —
   * o funcionário não pode começar as férias em sábado ou domingo.
   */
  function handleSelect(range: DateRange | undefined) {
    if (range?.from && isWeekend(range.from)) {
      return
    }
    setPeriodo(range)
  }

  function handleSolicitar() {
    // TODO: enviar à API quando o autosserviço estiver ligado ao usuário logado.
    console.info('Solicitação (mock):', {
      inicio: periodo?.from,
      fim: periodo?.to,
      abono,
      observacoes,
    })
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Nova Solicitação</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="pt-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Coluna 1: calendário */}
          <div className="flex flex-col gap-2">
            <Label>Selecione o período</Label>
            <div className="rounded-lg border">
              <Calendar
                mode="range"
                selected={periodo}
                onSelect={handleSelect}
                locale={ptBR}
                numberOfMonths={1}
                className="w-full"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              O início das férias não pode ser sábado ou domingo.
            </p>
          </div>

          {/* Coluna 2: demais campos */}
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="inicio">Início</Label>
                <Input id="inicio" value={formatarData(periodo?.from)} readOnly placeholder="dd/mm/aaaa" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="termino">Término</Label>
                <Input id="termino" value={formatarData(periodo?.to)} readOnly placeholder="dd/mm/aaaa" />
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Abono Pecuniário</p>
                <p className="text-xs text-muted-foreground">Venda de 10 dias de férias</p>
              </div>
              <Switch checked={abono} onCheckedChange={setAbono} />
            </label>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais para o gestor…"
                className="flex-1"
              />
            </div>

            <Button className="w-full" disabled={!podeSolicitar} onClick={handleSolicitar}>
              Solicitar férias
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
