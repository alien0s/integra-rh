import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import {
  format,
  isBefore,
  isValid,
  isWeekend,
  parse,
  startOfMonth,
  startOfToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

type TipoSolicitacao = 'ferias' | 'folga'

/** Formata uma data para exibição nos campos (dd/MM/yyyy). */
function formatarData(data?: Date): string {
  return data ? format(data, 'dd/MM/yyyy') : ''
}

/** Máscara dd/MM/yyyy enquanto o usuário digita (só dígitos + barras). */
function mascararData(valor: string): string {
  const d = valor.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

/**
 * Converte o texto em Date válida. Rejeita incompleto e datas inexistentes
 * (ex.: 31/02) comparando o texto com a data reformatada.
 */
function parseData(texto: string): Date | undefined {
  if (texto.length < 10) return undefined
  const data = parse(texto, 'dd/MM/yyyy', new Date())
  if (!isValid(data) || format(data, 'dd/MM/yyyy') !== texto) return undefined
  return data
}

/**
 * Formulário de nova solicitação (férias/folga): calendário de período com
 * inputs editáveis e inteligentes, abono (só férias) e observações.
 */
export function NovaSolicitacaoForm() {
  const [tipo, setTipo] = useState<TipoSolicitacao>('ferias')
  const [periodo, setPeriodo] = useState<DateRange | undefined>()
  const [inicioText, setInicioText] = useState('')
  const [terminoText, setTerminoText] = useState('')
  const [abono, setAbono] = useState(false)
  const [observacoes, setObservacoes] = useState('')

  // Limites: não permite datas/meses anteriores a hoje.
  const hoje = startOfToday()
  const inicioMes = startOfMonth(hoje)

  const podeSolicitar = Boolean(periodo?.from && periodo?.to)

  /** Início não pode ser passado nem (em férias) fim de semana. */
  function inicioInvalido(data: Date): boolean {
    return isBefore(data, hoje) || (tipo === 'ferias' && isWeekend(data))
  }

  /** Seleção pelo calendário — sincroniza os inputs de texto. */
  function handleSelect(range: DateRange | undefined) {
    if (range?.from && inicioInvalido(range.from)) return
    setPeriodo(range)
    setInicioText(formatarData(range?.from))
    setTerminoText(formatarData(range?.to))
  }

  /** Digitação do início — valida e atualiza o range/calendário. */
  function handleInicioChange(raw: string) {
    const texto = mascararData(raw)
    setInicioText(texto)

    const data = parseData(texto)
    if (!data || inicioInvalido(data)) return

    // Mantém o término só se continuar depois do novo início.
    const to = periodo?.to && !isBefore(periodo.to, data) ? periodo.to : undefined
    setPeriodo({ from: data, to })
    setTerminoText(formatarData(to))
  }

  /** Digitação do término — valida contra hoje e o início. */
  function handleTerminoChange(raw: string) {
    const texto = mascararData(raw)
    setTerminoText(texto)

    const data = parseData(texto)
    if (!data || isBefore(data, hoje)) return
    if (!periodo?.from || isBefore(data, periodo.from)) return

    setPeriodo({ from: periodo.from, to: data })
  }

  function handleSolicitar() {
    // TODO: enviar à API quando o autosserviço estiver ligado ao usuário logado.
    console.info('Solicitação (mock):', {
      tipo,
      inicio: periodo?.from,
      fim: periodo?.to,
      abono,
      observacoes,
    })
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <Tabs value={tipo} onValueChange={(v) => setTipo(v as TipoSolicitacao)}>
          <TabsList className="h-9">
            <TabsTrigger value="ferias" className="px-5">
              Férias
            </TabsTrigger>
            <TabsTrigger value="folga" className="px-5">
              Folga
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
                startMonth={inicioMes}
                disabled={{ before: hoje }}
                className="w-full"
              />
            </div>
            {tipo === 'ferias' && (
              <p className="text-xs text-muted-foreground">
                O início das férias não pode ser sábado ou domingo.
              </p>
            )}
          </div>

          {/* Coluna 2: demais campos */}
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="inicio">Início</Label>
                <Input
                  id="inicio"
                  value={inicioText}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => handleInicioChange(e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="termino">Término</Label>
                <Input
                  id="termino"
                  value={terminoText}
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(e) => handleTerminoChange(e.target.value)}
                  placeholder="dd/mm/aaaa"
                />
              </div>
            </div>

            {tipo === 'ferias' && (
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Abono Pecuniário</p>
                  <p className="text-xs text-muted-foreground">
                    Antecipação adicional de 1/3 (um terço) constitucional, salário antecipado
                  </p>
                </div>
                <Switch checked={abono} onCheckedChange={setAbono} />
              </label>
            )}

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
              {tipo === 'folga' ? 'Solicitar folga' : 'Solicitar férias'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
