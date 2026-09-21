import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'

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
import { usuariosService } from '@/features/usuarios/services'
import type { OpcaoSelecao } from '@/features/usuarios/types'

interface AtribuirGerenteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Opções do dropdown de setor. */
  setores: OpcaoSelecao[]
  /** Chamado após atribuir com sucesso (para recarregar a lista). */
  onAtribuido?: () => void
}

/**
 * Modal para indicar manualmente quem é gerente de um setor: escolhe o
 * setor e informa o e-mail da pessoa. Se ela ainda não tiver cadastro, é
 * criada só com email/setor/papel — os demais dados (nome, cpf, etc.) são
 * preenchidos automaticamente no 1º login dessa pessoa. Existe porque a
 * função vinda do legado (APS) nem sempre identifica corretamente quem é
 * gerente.
 */
export function AtribuirGerenteDialog({
  open,
  onOpenChange,
  setores,
  onAtribuido,
}: AtribuirGerenteDialogProps) {
  const [setorId, setSetorId] = useState('')
  const [email, setEmail] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function resetar() {
    setSetorId('')
    setEmail('')
    setErro(null)
  }

  async function handleSalvar() {
    setSalvando(true)
    setErro(null)
    try {
      await usuariosService.atribuirGerente({
        email: email.trim().toLowerCase(),
        setorId,
      })
      onAtribuido?.()
      resetar()
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atribuir gerente.')
    } finally {
      setSalvando(false)
    }
  }

  const podeSalvar = Boolean(setorId) && email.trim().length > 0
  // Gestor atual do setor selecionado (para avisar que vai substituir).
  const gestorAtual = setores.find((s) => s.id === setorId)?.gestorNome

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (salvando) return
        if (!aberto) resetar()
        onOpenChange(aberto)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Atribuir gerente</DialogTitle>
          <DialogDescription>
            Indique quem é o gerente de um setor pelo e-mail da pessoa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Setor</Label>
            <Select value={setorId} onValueChange={setSetorId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o setor" />
              </SelectTrigger>
              <SelectContent>
                {setores.map((setor) => (
                  <SelectItem key={setor.id} value={setor.id}>
                    {setor.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {gestorAtual ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Este setor já tem gerente:{' '}
                  <span className="font-medium">{gestorAtual}</span>. Ao salvar,
                  você vai substituí-lo.
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email-gerente">E-mail</Label>
            <Input
              id="email-gerente"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nome@adventistas.org"
            />
          </div>

          {erro ? (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{erro}</span>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={!podeSalvar || salvando}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
