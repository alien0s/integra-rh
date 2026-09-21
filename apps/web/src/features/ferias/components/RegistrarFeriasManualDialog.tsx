import { useState } from 'react'
import { CalendarPlus, Check, ChevronsUpDown } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import type { RegistrarFeriasManualInput } from '@/features/ferias/services'
import type { Usuario } from '@/features/usuarios/types'

type TipoRegistro = 'FERIAS' | 'FOLGA'

interface RegistrarFeriasManualDialogProps {
  /** Colaboradores disponíveis para seleção. */
  usuarios: Usuario[]
  /** Registra o lançamento. Lança erro em caso de falha (permissão, validação). */
  onRegistrar: (input: RegistrarFeriasManualInput) => Promise<void>
}

const FORM_VAZIO = {
  usuarioId: '',
  tipo: 'FERIAS' as TipoRegistro,
  dataInicio: '',
  dataFim: '',
  observacoes: '',
}

/**
 * Diálogo (RH/Admin) para registrar manualmente uma férias/folga que já
 * aconteceu FORA do sistema — histórico anterior à implantação, ou um
 * lançamento retroativo que passou batido do fluxo normal do colaborador.
 *
 * Diferente da solicitação normal (NovaSolicitacaoForm): aqui não existe a
 * regra de antecedência mínima de 40 dias nem a de não poder ser no passado
 * — é justamente o contrário, o registro é sobre algo que já aconteceu. O
 * lançamento já entra como APROVADO no backend (não passa por aprovação) e
 * conta no saldo do ciclo aquisitivo vigente, para refletir corretamente se
 * o colaborador ainda pode pedir férias novas naquele ciclo.
 */
export function RegistrarFeriasManualDialog({
  usuarios,
  onRegistrar,
}: RegistrarFeriasManualDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(FORM_VAZIO)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [colaboradorAberto, setColaboradorAberto] = useState(false)

  const usuarioSelecionado = usuarios.find((u) => u.id === form.usuarioId)

  const periodoValido =
    form.dataInicio.length > 0 &&
    form.dataFim.length > 0 &&
    form.dataFim >= form.dataInicio
  const podeRegistrar = form.usuarioId.length > 0 && periodoValido

  function fechar(novoAberto: boolean) {
    setAberto(novoAberto)
    if (!novoAberto) {
      setForm(FORM_VAZIO)
      setErro(null)
    }
  }

  async function handleRegistrar() {
    if (!podeRegistrar) return
    setEnviando(true)
    setErro(null)
    try {
      await onRegistrar({
        usuarioId: form.usuarioId,
        tipo: form.tipo,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim,
        observacoes: form.observacoes.trim() || null,
      })
      fechar(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={fechar}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-blue-600 text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
        >
          <CalendarPlus className="h-4 w-4" />
          Registrar manualmente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar férias/folga manualmente</DialogTitle>
          <DialogDescription>
            Para lançar algo que já aconteceu fora do sistema (histórico ou
            retroativo). Entra direto como{' '}
            <Badge variant="secondary" className="align-middle">
              Aprovado
            </Badge>{' '}
            e já conta no saldo do colaborador.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Colaborador</Label>
            <Popover open={colaboradorAberto} onOpenChange={setColaboradorAberto}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  role="combobox"
                  aria-expanded={colaboradorAberto}
                  className="w-full justify-between font-normal"
                >
                  {usuarioSelecionado ? (
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar className="h-7 w-7 rounded-md">
                        <AvatarImage
                          src={usuarioSelecionado.fotoUrl}
                          alt={usuarioSelecionado.nome}
                          className="rounded-md object-cover"
                        />
                        <AvatarFallback className="rounded-md text-xs">
                          {usuarioSelecionado.iniciais}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{usuarioSelecionado.nome}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      Selecione o colaborador
                    </span>
                  )}
                  <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-(--radix-popover-trigger-width) p-0"
              >
                <Command>
                  <CommandInput placeholder="Buscar colaborador…" />
                  {/* O Popover (pacote "radix-ui") fica dentro de um Dialog
                      (pacote "@radix-ui/react-dialog" separado) — como não
                      compartilham a mesma instância interna do Radix, o
                      bloqueio de scroll do body do Dialog acaba capturando a
                      roda do mouse antes de chegar na lista. Rolamos
                      manualmente e paramos a propagação pra evitar isso. */}
                  <CommandList
                    onWheel={(event) => {
                      event.currentTarget.scrollTop += event.deltaY
                      event.stopPropagation()
                    }}
                  >
                    <CommandEmpty>Nenhum colaborador encontrado.</CommandEmpty>
                    <CommandGroup>
                      {usuarios.map((usuario) => (
                        <CommandItem
                          key={usuario.id}
                          value={usuario.nome}
                          className="gap-2.5 py-2.5"
                          onSelect={() => {
                            setForm((f) => ({ ...f, usuarioId: usuario.id }))
                            setColaboradorAberto(false)
                          }}
                        >
                          <Avatar className="h-8 w-8 rounded-md">
                            <AvatarImage
                              src={usuario.fotoUrl}
                              alt={usuario.nome}
                              className="rounded-md object-cover"
                            />
                            <AvatarFallback className="rounded-md text-xs">
                              {usuario.iniciais}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate text-sm">{usuario.nome}</span>
                          <Check
                            className={cn(
                              'h-4 w-4',
                              usuario.id === form.usuarioId ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Tipo</Label>
            <Select
              value={form.tipo}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, tipo: value as TipoRegistro }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FERIAS">Férias</SelectItem>
                <SelectItem value="FOLGA">Folga</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-inicio">Início</Label>
              <Input
                id="reg-inicio"
                type="date"
                value={form.dataInicio}
                onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reg-fim">Término</Label>
              <Input
                id="reg-fim"
                type="date"
                value={form.dataFim}
                onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
              />
            </div>
          </div>
          {form.dataInicio && form.dataFim && !periodoValido && (
            <p className="text-xs text-destructive">
              O término não pode ser antes do início.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="reg-observacoes">Observações</Label>
            <Textarea
              id="reg-observacoes"
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
              placeholder="Ex.: férias tiradas em 2023, lançamento retroativo…"
            />
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancelar
            </Button>
          </DialogClose>
          <Button
            size="sm"
            onClick={handleRegistrar}
            disabled={!podeRegistrar || enviando}
          >
            {enviando ? 'Registrando…' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
