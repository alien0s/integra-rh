import { useEffect, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import {
  addDays,
  format,
  isBefore,
  isFriday,
  isSameDay,
  isValid,
  isWeekend,
  parse,
  startOfMonth,
  startOfToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Eraser } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { usePreferenciaFerias30 } from '@/lib/preferencias'
import {
  feriadosService,
  type CriarSolicitacaoInput,
} from '@/features/ferias/services'

type TipoSolicitacao = 'ferias' | 'folga'

interface NovaSolicitacaoFormProps {
  /** Envia a solicitação à API. Se ausente, só loga (modo mock). */
  onSolicitar?: (input: CriarSolicitacaoInput) => Promise<void>
  /**
   * Já existe uma solicitação de FÉRIAS pendente — bloqueia pedir férias de
   * novo (regra validada também no backend). Folga continua liberada.
   */
  temFeriasPendente?: boolean
  /**
   * Já tem férias APROVADAS neste período aquisitivo (ciclo de 12 meses) —
   * também bloqueia pedir férias de novo (regra validada também no backend,
   * ver SolicitacaoFeriasJaAprovadaError). Folga continua liberada.
   */
  temFeriasAprovadaNoCiclo?: boolean
  /**
   * Exceções liberadas pelo DP (aba "Exceções") — opcionais, nunca
   * obrigatórias: quem tem `podeFracionarFerias` continua podendo pedir um
   * período único de até 30 dias, como quem não tem.
   */
  podeFracionarFerias?: boolean
  /** Libera o campo de dias a vender (abono), 0-10. */
  podeVenderFerias?: boolean
}

/** Duração padrão de férias em dias corridos (usada no preenchimento automático). */
const DIAS_FERIAS = 30

/**
 * Antecedência mínima (em dias) para solicitar FÉRIAS, contada a partir de
 * hoje. A CLT (art. 145) exige no mínimo 30 dias; aqui a política da empresa
 * usa 40. Não se aplica à FOLGA.
 */
const ANTECEDENCIA_MINIMA_FERIAS_DIAS = 40

/** Máximo de dias vendidos (abono pecuniário) — regra CLT de até 1/3 de 30. */
const DIAS_VENDA_MAXIMO = 10

/**
 * As FÉRIAS não podem começar em sexta, sábado ou domingo (evita emendar o
 * início no fim de semana / véspera de descanso). Não se aplica à FOLGA.
 */
function diaInicioProibido(data: Date): boolean {
  return isFriday(data) || isWeekend(data)
}

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
 * inputs editáveis e inteligentes e observações.
 */
export function NovaSolicitacaoForm({
  onSolicitar,
  temFeriasPendente = false,
  temFeriasAprovadaNoCiclo = false,
  podeFracionarFerias = false,
  podeVenderFerias = false,
}: NovaSolicitacaoFormProps) {
  const [tipo, setTipo] = useState<TipoSolicitacao>('ferias')
  const [periodo, setPeriodo] = useState<DateRange | undefined>()
  const [inicioText, setInicioText] = useState('')
  const [terminoText, setTerminoText] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [diasVendidosText, setDiasVendidosText] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [auto30] = usePreferenciaFerias30()
  // Feriados (ano atual + próximo) para bloquear o início das férias.
  const [feriadoSet, setFeriadoSet] = useState<Set<string>>(new Set())
  const [feriadoDates, setFeriadoDates] = useState<Date[]>([])

  useEffect(() => {
    let ativo = true
    const anoAtual = new Date().getFullYear()
    Promise.all([
      feriadosService.listar(anoAtual),
      feriadosService.listar(anoAtual + 1),
    ])
      .then((listas) => {
        if (!ativo) return
        const todos = listas.flat()
        setFeriadoSet(new Set(todos.map((f) => f.data)))
        // "YYYY-MM-DD" → Date local (evita susto de fuso).
        setFeriadoDates(
          todos.map((f) => {
            const [a, m, d] = f.data.split('-').map(Number)
            return new Date(a, m - 1, d)
          }),
        )
      })
      .catch(() => {
        /* sem feriados carregados: o backend ainda valida no envio */
      })
    return () => {
      ativo = false
    }
  }, [])

  /** É um feriado cadastrado (bloqueia o início das férias). */
  function ehFeriado(data: Date): boolean {
    return feriadoSet.has(format(data, 'yyyy-MM-dd'))
  }

  /** É a véspera de um feriado cadastrado (também bloqueia o início). */
  function ehVesperaDeFeriado(data: Date): boolean {
    return feriadoSet.has(format(addDays(data, 1), 'yyyy-MM-dd'))
  }

  // Dias desabilitados no calendário por causa de feriado: o próprio feriado
  // e a véspera de cada um (o início das férias não pode emendar num
  // feriado). Derivado de feriadoDates — recalculado só quando ele muda.
  const feriadoOuVesperaDates = feriadoDates.flatMap((d) => [d, addDays(d, -1)])

  // Bloqueia pedir férias de novo enquanto já houver uma pendente OU já
  // aprovada neste ciclo aquisitivo (folga continua liberada em ambos os
  // casos).
  const bloqueadoPorJaAprovada = tipo === 'ferias' && temFeriasAprovadaNoCiclo
  const bloqueadoPorPendencia =
    tipo === 'ferias' && (temFeriasPendente || temFeriasAprovadaNoCiclo)

  // Limites: não permite datas/meses anteriores a hoje.
  const hoje = startOfToday()
  const inicioMes = startOfMonth(hoje)
  // Primeira data em que FÉRIAS podem começar (hoje + 40 dias — ver
  // ANTECEDENCIA_MINIMA_FERIAS_DIAS acima). FOLGA não tem esse piso.
  const primeiraDataPermitidaFerias = addDays(hoje, ANTECEDENCIA_MINIMA_FERIAS_DIAS)

  /** Início de férias respeita a antecedência mínima (folga não tem essa regra). */
  function antecedenciaFeriasValida(data: Date): boolean {
    return tipo !== 'ferias' || !isBefore(data, primeiraDataPermitidaFerias)
  }

  const podeSolicitar =
    !bloqueadoPorPendencia &&
    Boolean(periodo?.from && periodo?.to && antecedenciaFeriasValida(periodo.from))

  // Preenche 30 dias automaticamente ao escolher o início (só férias e se ligado
  // nas Configurações). Retorna o término a usar, ou o padrão informado.
  function terminoAutomatico(inicio: Date, padrao?: Date): Date | undefined {
    if (auto30 && tipo === 'ferias') {
      return addDays(inicio, DIAS_FERIAS - 1)
    }
    return padrao
  }

  /** Limita o término a no máximo 30 dias de férias (inclusive). */
  function limitarTermino(inicio: Date, fim: Date): Date {
    if (tipo !== 'ferias') return fim
    const maximo = addDays(inicio, DIAS_FERIAS - 1)
    return isBefore(maximo, fim) ? maximo : fim
  }

  /** Limpa o período selecionado. */
  function handleLimpar() {
    setPeriodo(undefined)
    setInicioText('')
    setTerminoText('')
  }

  /**
   * Início não pode ser passado, nem (em férias) cair em sexta/sábado/domingo,
   * em feriado, na véspera de um feriado, ou ficar dentro da janela de
   * antecedência mínima de 40 dias (política da empresa). Folga não tem
   * nenhuma dessas restrições extras.
   */
  function inicioInvalido(data: Date): boolean {
    if (isBefore(data, hoje)) return true
    if (tipo !== 'ferias') return false
    return (
      diaInicioProibido(data) ||
      ehFeriado(data) ||
      ehVesperaDeFeriado(data) ||
      !antecedenciaFeriasValida(data)
    )
  }

  /** Seleção pelo calendário — sincroniza os inputs de texto. */
  function handleSelect(range: DateRange | undefined) {
    if (range?.from && inicioInvalido(range.from)) return

    // Ao escolher só o início (1º clique = to ausente ou igual ao from),
    // preenche 30 dias se a preferência estiver ligada. O 2º clique (término
    // diferente) é respeitado, mas limitado a 30 dias.
    let novo = range
    const soInicio =
      range?.from && (!range.to || isSameDay(range.from, range.to))
    if (soInicio && range?.from) {
      const to = terminoAutomatico(range.from)
      if (to) novo = { from: range.from, to }
    } else if (range?.from && range?.to) {
      novo = { from: range.from, to: limitarTermino(range.from, range.to) }
    }

    setPeriodo(novo)
    setInicioText(formatarData(novo?.from))
    setTerminoText(formatarData(novo?.to))
  }

  /** Digitação do início — valida e atualiza o range/calendário. */
  function handleInicioChange(raw: string) {
    const texto = mascararData(raw)
    setInicioText(texto)

    const data = parseData(texto)
    if (!data || inicioInvalido(data)) return

    // Mantém o término só se continuar depois do novo início; senão, aplica o
    // preenchimento automático de 30 dias (se ligado).
    const manterTo =
      periodo?.to && !isBefore(periodo.to, data) ? periodo.to : undefined
    const to = terminoAutomatico(data, manterTo)
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

    // Não deixa passar de 30 dias de férias — limita o término.
    const to = limitarTermino(periodo.from, data)
    setPeriodo({ from: periodo.from, to })
    if (!isSameDay(to, data)) setTerminoText(formatarData(to))
  }

  /**
   * Troca de aba (férias/folga). Se o período já selecionado deixar de ser
   * válido ao mudar para férias (sexta/fim de semana ou dentro dos 40 dias de
   * antecedência mínima), limpa a seleção em vez de deixar um período
   * inválido "preso" no formulário.
   */
  function handleTipoChange(novoTipo: TipoSolicitacao) {
    setTipo(novoTipo)
    if (novoTipo === 'ferias' && periodo?.from) {
      const aindaValido =
        !diaInicioProibido(periodo.from) &&
        !ehFeriado(periodo.from) &&
        !ehVesperaDeFeriado(periodo.from) &&
        !isBefore(periodo.from, primeiraDataPermitidaFerias)
      if (!aindaValido) handleLimpar()
    }
  }

  async function handleSolicitar() {
    if (!periodo?.from || !periodo?.to) return
    // Reforço de segurança: bloqueia o envio também aqui, não só a seleção no
    // calendário (regra de antecedência mínima de 40 dias e de solicitação
    // de férias já pendente — ambas validadas de novo no backend).
    if (!antecedenciaFeriasValida(periodo.from) || bloqueadoPorPendencia) return

    const diasVendidos =
      tipo === 'ferias' && podeVenderFerias ? Number(diasVendidosText) || 0 : 0

    const input = {
      tipo: tipo === 'folga' ? ('FOLGA' as const) : ('FERIAS' as const),
      dataInicio: format(periodo.from, 'yyyy-MM-dd'),
      dataFim: format(periodo.to, 'yyyy-MM-dd'),
      observacoes: observacoes.trim() || null,
      ...(diasVendidos > 0 ? { diasVendidos } : {}),
    }

    setEnviando(true)
    setErro(null)
    try {
      await onSolicitar?.(input)
      // Limpa o formulário após enviar.
      handleLimpar()
      setObservacoes('')
      setDiasVendidosText('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar a solicitação.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <Tabs value={tipo} onValueChange={(v) => handleTipoChange(v as TipoSolicitacao)}>
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
      <CardContent className="pt-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Coluna 1: calendário */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Selecione o período</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                onClick={handleLimpar}
                disabled={!periodo?.from}
              >
                <Eraser className="h-3.5 w-3.5" />
                Limpar
              </Button>
            </div>
            <div className="rounded-lg border">
              <Calendar
                mode="range"
                selected={periodo}
                onSelect={handleSelect}
                locale={ptBR}
                numberOfMonths={1}
                startMonth={inicioMes}
                // Férias: bloqueia tudo antes dos 40 dias mínimos de
                // antecedência (não só "antes de hoje"), os feriados
                // cadastrados e a véspera de cada um. Folga usa só hoje.
                disabled={
                  tipo === 'ferias'
                    ? [{ before: primeiraDataPermitidaFerias }, ...feriadoOuVesperaDates]
                    : { before: hoje }
                }
                className="w-full"
              />
            </div>
            {/* O aviso de antecedência mínima (40 dias) fica só no card
                "Lembrete de Política" (HistoricoSolicitacoes.tsx) — evita
                repetir o mesmo aviso duas vezes na mesma tela. */}
            {tipo === 'ferias' && (
              <p className="text-xs text-muted-foreground">
                O início das férias não pode ser sexta, sábado, domingo, feriado
                ou a véspera de um feriado.
              </p>
            )}
            {tipo === 'ferias' && podeFracionarFerias && (
              <p className="text-xs text-muted-foreground">
                Você pode dividir suas férias em até 2 períodos de 10 a 15 dias
                cada, somando no máximo 30 dias no ciclo.
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

            {tipo === 'ferias' && podeVenderFerias && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="dias-vendidos">Dias a vender (abono, opcional)</Label>
                <Input
                  id="dias-vendidos"
                  value={diasVendidosText}
                  inputMode="numeric"
                  maxLength={2}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, '')
                    const numero = digitos === '' ? '' : String(
                      Math.min(DIAS_VENDA_MAXIMO, Number(digitos)),
                    )
                    setDiasVendidosText(numero)
                  }}
                  placeholder={`0 a ${DIAS_VENDA_MAXIMO}`}
                />
              </div>
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

            {bloqueadoPorJaAprovada ? (
              <p className="text-xs text-destructive">
                Você já tem férias aprovadas para este período aquisitivo — aguarde o
                próximo ciclo para solicitar novamente.
              </p>
            ) : (
              bloqueadoPorPendencia && (
                <p className="text-xs text-destructive">
                  Você já tem uma solicitação de férias pendente — aguarde a decisão do RH
                  antes de pedir de novo.
                </p>
              )
            )}
            {erro && <p className="text-xs text-destructive">{erro}</p>}

            <Button
              className="w-full"
              disabled={!podeSolicitar || enviando}
              onClick={handleSolicitar}
            >
              {enviando
                ? 'Enviando…'
                : tipo === 'folga'
                  ? 'Solicitar folga'
                  : 'Solicitar férias'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
