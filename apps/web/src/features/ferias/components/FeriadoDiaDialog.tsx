import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TIPOS_FERIADO } from '@/features/ferias/constants'
import type { Feriado, TipoFeriado } from '@/features/ferias/types'

/** Payload de criação/edição de um feriado (data já resolvida do dia clicado). */
interface FeriadoInput {
  data: string
  nome: string
  tipo: TipoFeriado
}

interface FeriadoDiaDialogProps {
  /** Dia clicado no calendário; `null` = dialog fechado. */
  dia: Date | null
  /** Feriado já existente naquele dia (quando houver) — ativa o modo edição. */
  feriado?: Feriado
  /** Fecha o dialog (o pai zera o `dia`). */
  onFechar: () => void
  /** Cria um feriado novo. */
  onCriar: (input: FeriadoInput) => Promise<void>
  /** Atualiza um feriado existente. */
  onAtualizar: (id: string, input: FeriadoInput) => Promise<void>
  /** Exclui um feriado existente. */
  onExcluir: (id: string) => Promise<void>
}

/**
 * Editor de um dia do calendário de feriados: cadastra um feriado novo, ou
 * edita/exclui o que já existe naquela data. É controlado pelo `FeriadosAdmin`
 * — abre quando `dia` é uma data e fecha via `onFechar`.
 */
export function FeriadoDiaDialog({
  dia,
  feriado,
  onFechar,
  onCriar,
  onAtualizar,
  onExcluir,
}: FeriadoDiaDialogProps) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoFeriado>('NACIONAL')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Reseta os campos ao (re)abrir num dia/feriado diferente. Usa a "chave" do
  // dia como gatilho — evita um useEffect e mantém o form em sincronia mesmo
  // que o dialog seja reaproveitado entre dias sem desmontar.
  const chave = dia ? format(dia, 'yyyy-MM-dd') : null
  const [chaveAtual, setChaveAtual] = useState<string | null>(null)
  if (chave !== chaveAtual) {
    setChaveAtual(chave)
    setNome(feriado?.nome ?? '')
    setTipo(feriado?.tipo ?? 'NACIONAL')
    setErro(null)
  }

  // Sem dia selecionado, não renderiza nada (dialog fechado).
  if (!dia) return null
  const data = format(dia, 'yyyy-MM-dd')
  const dataLegivel = format(dia, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })

  /** Salva: cria (dia sem feriado) ou atualiza (dia com feriado). */
  async function salvar() {
    if (!nome.trim()) {
      setErro('Informe o nome do feriado.')
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      if (feriado) {
        await onAtualizar(feriado.id, { data, nome: nome.trim(), tipo })
      } else {
        await onCriar({ data, nome: nome.trim(), tipo })
      }
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  /** Exclui o feriado do dia (só existe no modo edição). */
  async function remover() {
    if (!feriado) return
    setSalvando(true)
    try {
      await onExcluir(feriado.id)
      onFechar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao excluir.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{feriado ? 'Editar feriado' : 'Novo feriado'}</DialogTitle>
          <DialogDescription className="capitalize">{dataLegivel}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Nome do feriado (obrigatório). Enter salva. */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="feriado-nome">Nome</Label>
            <Input
              id="feriado-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Independência do Brasil"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && salvar()}
            />
          </div>

          {/* Tipo do feriado (abrangência). */}
          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFeriado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FERIADO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {erro && <p className="text-xs text-destructive">{erro}</p>}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          {/* Excluir só aparece no modo edição; senão um spacer mantém o layout. */}
          {feriado ? (
            <Button
              variant="outline"
              size="sm"
              onClick={remover}
              disabled={salvando}
              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onFechar} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
