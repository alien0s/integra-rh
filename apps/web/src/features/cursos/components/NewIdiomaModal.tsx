import { useState, type FormEvent, type ReactNode } from 'react'
import { Languages } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { NIVEL_CEFR_LABEL } from '@/lib/cursos'
import type { NivelCEFR, NovoIdiomaInput } from '../types'

interface NewIdiomaModalProps {
  children: ReactNode
  onCriar: (input: NovoIdiomaInput) => Promise<unknown>
}

const NIVEIS = Object.keys(NIVEL_CEFR_LABEL) as NivelCEFR[]

export function NewIdiomaModal({ children, onCriar }: NewIdiomaModalProps) {
  const [open, setOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [idioma, setIdioma] = useState('')
  const [nivelCefr, setNivelCefr] = useState<NivelCEFR | ''>('')
  // Campos obrigatórios pra cadastrar (idioma e nível) — enquanto algum
  // estiver vazio, o botão "Adicionar idioma" fica desabilitado.
  const podeEnviar = Boolean(idioma.trim() && nivelCefr)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!podeEnviar || !nivelCefr) return

    setEnviando(true)
    try {
      await onCriar({ idioma: idioma.trim(), nivelCefr })
      setOpen(false)
      setIdioma('')
      setNivelCefr('')
      event.currentTarget.reset()
      toast({
        title: 'Idioma enviado',
        description: 'Cadastrado como pendente — aguarda aprovação do RH.',
        duration: 4000,
      })
    } catch (error) {
      toast({
        title: 'Não foi possível cadastrar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Languages className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Novo idioma</DialogTitle>
              <DialogDescription>
                Autodeclarado — entra como pendente até o RH aprovar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="idioma-nome">Idioma</Label>
            <Input
              id="idioma-nome"
              name="idioma"
              value={idioma}
              onChange={(event) => setIdioma(event.target.value)}
              placeholder="Ex: Inglês"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="idioma-nivel">Nível (CEFR)</Label>
            <Select value={nivelCefr} onValueChange={(v) => setNivelCefr(v as NivelCEFR)} required>
              <SelectTrigger id="idioma-nivel">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {NIVEIS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {NIVEL_CEFR_LABEL[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={enviando || !podeEnviar}>
              {enviando ? 'Enviando…' : 'Adicionar idioma'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
