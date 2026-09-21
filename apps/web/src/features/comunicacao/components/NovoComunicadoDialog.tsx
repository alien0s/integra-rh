import { useState } from 'react'
import { ptBR } from 'date-fns/locale'
import { Megaphone } from 'lucide-react'
import type { DateRange } from 'react-day-picker'

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

import { comunicacaoService } from '../services'
import type { DiaSemana } from '../types'

interface NovoComunicadoDialogProps {
  /** Chamado depois de criar com sucesso (ex.: recarregar o mural da Home). */
  onCriado?: () => void
}

const DIAS_SEMANA_LABEL: Record<DiaSemana, string> = {
  0: 'Domingo',
  1: 'Segunda-feira',
  2: 'Terça-feira',
  3: 'Quarta-feira',
  4: 'Quinta-feira',
  5: 'Sexta-feira',
  6: 'Sábado',
}

const TIPOS_ANEXO_ACEITOS = 'image/jpeg,image/png,image/webp,application/pdf'

/** "2026-11-21" a partir de um Date, sem deslocamento de fuso (usa campos locais). */
function paraIsoLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/**
 * Dialog "Novo comunicado": título/descrição, período (calendário de
 * intervalo), opção de recorrência semanal e anexo opcional (imagem/PDF).
 * Cria o comunicado e, se houver arquivo, envia o anexo em seguida.
 */
export function NovoComunicadoDialog({ onCriado }: NovoComunicadoDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [periodo, setPeriodo] = useState<DateRange | undefined>()
  const [recorrente, setRecorrente] = useState(false)
  const [diaSemana, setDiaSemana] = useState<DiaSemana>(1)
  const [anexo, setAnexo] = useState<File | null>(null)

  function limpar() {
    setTitulo('')
    setDescricao('')
    setPeriodo(undefined)
    setRecorrente(false)
    setDiaSemana(1)
    setAnexo(null)
    setErro(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErro(null)

    if (!recorrente && (!periodo?.from || !periodo?.to)) {
      setErro('Selecione o período (data de início e fim).')
      return
    }

    setEnviando(true)
    try {
      const comunicado = await comunicacaoService.criar({
        titulo,
        descricao,
        dataInicio: recorrente ? undefined : paraIsoLocal(periodo!.from!),
        dataFim: recorrente ? undefined : paraIsoLocal(periodo!.to!),
        recorrente,
        diaSemana: recorrente ? diaSemana : undefined,
      })

      if (anexo) {
        await comunicacaoService.enviarAnexo(comunicado.id, anexo)
      }

      setAberto(false)
      limpar()
      onCriado?.()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao criar o comunicado.')
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
        <Button size="sm">
          <Megaphone className="mr-2 h-4 w-4" />
          Novo anúncio
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo comunicado</DialogTitle>
          <DialogDescription>
            Se você não for do RH, o comunicado fica aguardando aprovação antes de entrar no ar.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Coluna esquerda: campos, um embaixo do outro */}
            <div className={`flex w-full flex-col gap-3 ${recorrente ? '' : 'sm:w-64 sm:shrink-0'}`}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comunicado-titulo">Título</Label>
                <Input
                  id="comunicado-titulo"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comunicado-descricao">Descrição</Label>
                <textarea
                  id="comunicado-descricao"
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Repetir toda semana (sem período — fica no ar todo esse dia)
              </label>

              {recorrente && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="comunicado-dia-semana">Dia da semana</Label>
                  <select
                    id="comunicado-dia-semana"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={diaSemana}
                    onChange={(e) => setDiaSemana(Number(e.target.value) as DiaSemana)}
                  >
                    {Object.entries(DIAS_SEMANA_LABEL).map(([valor, label]) => (
                      <option key={valor} value={valor}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comunicado-anexo">Anexo (opcional)</Label>
                <input
                  id="comunicado-anexo"
                  type="file"
                  accept={TIPOS_ANEXO_ACEITOS}
                  onChange={(e) => setAnexo(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Coluna direita: calendário de período — só faz sentido pra não-recorrente */}
            {!recorrente && (
              <div className="flex flex-1 flex-col gap-1.5">
                <Label>Período</Label>
                <div className="flex justify-center rounded-md border">
                  <Calendar
                    mode="range"
                    locale={ptBR}
                    selected={periodo}
                    onSelect={setPeriodo}
                    numberOfMonths={1}
                  />
                </div>
              </div>
            )}
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}

          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Criar comunicado'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
