import { useEffect, useMemo, useState } from 'react'

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

import type {
  AtualizarUsuarioInput,
  OpcaoSelecao,
  Usuario,
} from '@/features/usuarios/types'
import { PAPEIS } from '@/features/usuarios/types'
import { mascararCpf, mascararTelefone } from '@/lib/masks'

interface EditarUsuarioModalProps {
  /** Usuário em edição (null quando o modal está fechado). */
  usuario: Usuario | null
  /** Opções dos dropdowns. */
  departamentos: OpcaoSelecao[]
  funcoes: OpcaoSelecao[]
  /** Indica que o salvamento está em andamento. */
  isSaving?: boolean
  onClose: () => void
  onSalvar: (input: AtualizarUsuarioInput) => void
}

/** Estado do formulário de edição. */
interface FormState {
  cpf: string
  telefone: string
  departamentoId: string
  funcaoId: string
  papelCodigo: string
}

/** Acha o id de uma opção pelo nome (para pré-selecionar os dropdowns). */
function idPorNome(opcoes: OpcaoSelecao[], nome: string): string {
  return opcoes.find((opcao) => opcao.nome === nome)?.id ?? ''
}

/**
 * Modal de edição das informações do usuário (cpf, telefone, departamento e
 * função). O botão Salvar só habilita quando há alteração no formulário.
 */
export function EditarUsuarioModal({
  usuario,
  departamentos,
  funcoes,
  isSaving = false,
  onClose,
  onSalvar,
}: EditarUsuarioModalProps) {
  const [form, setForm] = useState<FormState>({
    cpf: '',
    telefone: '',
    departamentoId: '',
    funcaoId: '',
    papelCodigo: '',
  })

  // Valores iniciais (para detectar alterações e habilitar o Salvar).
  const initial = useMemo<FormState>(
    () => ({
      cpf: usuario?.cpf ?? '',
      telefone: usuario?.telefone ?? '',
      departamentoId: usuario ? idPorNome(departamentos, usuario.departamento) : '',
      funcaoId: usuario ? idPorNome(funcoes, usuario.funcao) : '',
      papelCodigo: usuario?.papelCodigo ?? '',
    }),
    [usuario, departamentos, funcoes],
  )

  // Sincroniza o form quando abre com um novo usuário/opções.
  useEffect(() => {
    setForm(initial)
  }, [initial])

  const alterado =
    form.cpf !== initial.cpf ||
    form.telefone !== initial.telefone ||
    form.departamentoId !== initial.departamentoId ||
    form.funcaoId !== initial.funcaoId ||
    form.papelCodigo !== initial.papelCodigo

  function handleSalvar() {
    onSalvar({
      cpf: form.cpf.trim() || null,
      telefone: form.telefone.trim() || null,
      departamentoId: form.departamentoId || null,
      funcaoId: form.funcaoId || null,
      roleCodigo: form.papelCodigo || null,
    })
  }

  return (
    <Dialog
      open={Boolean(usuario)}
      onOpenChange={(aberto) => !aberto && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Atualize os dados de {usuario?.nome}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={form.cpf}
              inputMode="numeric"
              maxLength={14}
              onChange={(event) =>
                setForm((f) => ({ ...f, cpf: mascararCpf(event.target.value) }))
              }
              placeholder="000.000.000-00"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              value={form.telefone}
              inputMode="tel"
              maxLength={19}
              onChange={(event) =>
                setForm((f) => ({
                  ...f,
                  telefone: mascararTelefone(event.target.value),
                }))
              }
              placeholder="+55 (00) 00000-0000"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Departamento</Label>
            <Select
              value={form.departamentoId}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, departamentoId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o departamento" />
              </SelectTrigger>
              <SelectContent>
                {departamentos.map((dep) => (
                  <SelectItem key={dep.id} value={dep.id}>
                    {dep.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Função</Label>
            <Select
              value={form.funcaoId}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, funcaoId: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a função" />
              </SelectTrigger>
              <SelectContent>
                {funcoes.map((funcao) => (
                  <SelectItem key={funcao.id} value={funcao.id}>
                    {funcao.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Papel</Label>
            <Select
              value={form.papelCodigo}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, papelCodigo: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o papel" />
              </SelectTrigger>
              <SelectContent>
                {PAPEIS.map((papel) => (
                  <SelectItem key={papel.codigo} value={papel.codigo}>
                    {papel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={!alterado || isSaving}
          >
            {isSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
