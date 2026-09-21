import { useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PencilLine } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface SugerirAjusteDialogProps {
  /** ID da solicitação de férias. */
  id: string
  funcionarioNome: string
  /** Período atual (formatado), ex.: "10 – 30 de novembro". */
  periodo: string
  /** Início atual das férias — ancora a janela de ±5 dias permitida. */
  inicioFerias: Date
  /** Duração (dias corridos) — usada pra calcular o "fim" do novo período. */
  dias: number
  onSugerirAjuste?: (id: string, dataInicioSugerida: string, motivo: string) => void
}

/** Deslocamento máximo (dias, pra antes ou depois) que o DP pode sugerir — espelha a API. */
const LIMITE_AJUSTE_DP_DIAS = 5

/**
 * Diálogo "Sugerir ajuste de data" — alternativa à confirmação direta (2ª
 * etapa): o DP devolve ao colaborador uma sugestão de novo início (até
 * LIMITE_AJUSTE_DP_DIAS dias antes ou depois do período atual, mesma
 * duração) em vez de confirmar. Volta pro colaborador aceitar (ver
 * podeAceitarAjuste em FeriasRequestCard.tsx).
 */
export function SugerirAjusteDialog({
  id,
  funcionarioNome,
  periodo,
  inicioFerias,
  dias,
  onSugerirAjuste,
}: SugerirAjusteDialogProps) {
  // Data original da solicitação — os inputs partem preenchidos com ela, e o
  // envio só libera quando o novo início realmente muda.
  const dataOriginal = format(inicioFerias, 'yyyy-MM-dd')

  const [ajusteAberto, setAjusteAberto] = useState(false)
  const [novaDataInicio, setNovaDataInicio] = useState(dataOriginal)
  const [motivoAjusteForm, setMotivoAjusteForm] = useState('')

  // Janela permitida pro ajuste do DP — mesmo limite validado na API.
  const ajusteMinData = addDays(inicioFerias, -LIMITE_AJUSTE_DP_DIAS)
  const ajusteMaxData = addDays(inicioFerias, LIMITE_AJUSTE_DP_DIAS)

  const dataInalterada = novaDataInicio === dataOriginal

  function confirmarAjuste() {
    if (!novaDataInicio || dataInalterada || !motivoAjusteForm.trim()) return
    onSugerirAjuste?.(id, novaDataInicio, motivoAjusteForm.trim())
    setNovaDataInicio(dataOriginal)
    setMotivoAjusteForm('')
    setAjusteAberto(false)
  }

  return (
    <Dialog open={ajusteAberto} onOpenChange={setAjusteAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PencilLine className="h-3.5 w-3.5" />
          Sugerir ajuste
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sugerir ajuste de data</DialogTitle>
          <DialogDescription>
            Proponha um novo início pras férias de {funcionarioNome} (até{' '}
            {LIMITE_AJUSTE_DP_DIAS} dias antes ou depois de {periodo}, mesma
            duração). Volta pro colaborador aceitar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Coluna 1: calendário */}
          <div className="flex flex-col gap-2">
            <Label>Selecione o novo início</Label>
            <div className="flex justify-center rounded-lg border">
              <Calendar
                mode="single"
                selected={novaDataInicio ? parseISO(novaDataInicio) : undefined}
                onSelect={(date) => setNovaDataInicio(date ? format(date, 'yyyy-MM-dd') : '')}
                locale={ptBR}
                numberOfMonths={1}
                defaultMonth={inicioFerias}
                disabled={{ before: ajusteMinData, after: ajusteMaxData }}
              />
            </div>
          </div>

          {/* Coluna 2: datas resultantes + motivo */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor={`ajuste-inicio-${id}`}>Início</Label>
                <Input
                  id={`ajuste-inicio-${id}`}
                  readOnly
                  value={novaDataInicio ? format(parseISO(novaDataInicio), 'dd/MM/yyyy') : ''}
                  placeholder="dd/mm/aaaa"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`ajuste-fim-${id}`}>Fim</Label>
                <Input
                  id={`ajuste-fim-${id}`}
                  readOnly
                  value={
                    novaDataInicio
                      ? format(addDays(parseISO(novaDataInicio), dias - 1), 'dd/MM/yyyy')
                      : ''
                  }
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor={`ajuste-motivo-${id}`}>Motivo</Label>
              <Textarea
                id={`ajuste-motivo-${id}`}
                value={motivoAjusteForm}
                onChange={(e) => setMotivoAjusteForm(e.target.value)}
                placeholder="Explique por que está sugerindo essa data…"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={confirmarAjuste}
            disabled={!novaDataInicio || dataInalterada || motivoAjusteForm.trim().length === 0}
          >
            Enviar sugestão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
