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
import type { Papel } from '@/features/tabelas/types'
import { mascararCpf, mascararTelefone } from '@/lib/masks'

interface EditarUsuarioModalProps {
  /** Usuário em edição (null quando o modal está fechado). */
  usuario: Usuario | null
  /** Opções dos dropdowns. */
  entidades: OpcaoSelecao[]
  setores: OpcaoSelecao[]
  funcoes: OpcaoSelecao[]
  papeis: Papel[]
  /** Indica que o salvamento está em andamento. */
  isSaving?: boolean
  /**
   * Restringe a edição a CPF/telefone — usado quando o COLABORADOR edita o
   * próprio perfil (em "Meu perfil"): entidade/setor/função/papel exigem o
   * RH/DP, então nem aparecem aqui (também não seria aceito pela API nesse
   * caso — ver PATCH /usuarios/:id).
   */
  apenasContato?: boolean
  onClose: () => void
  onSalvar: (input: AtualizarUsuarioInput) => void
}

/** Estado do formulário de edição. */
interface FormState {
  entidadeId: string
  cpf: string
  telefone: string
  setorId: string
  funcaoId: string
  papelCodigo: string
}

/** Acha o id de uma opção pelo nome (para pré-selecionar os dropdowns). */
function idPorNome(opcoes: OpcaoSelecao[], nome: string): string {
  return opcoes.find((opcao) => opcao.nome === nome)?.id ?? ''
}

/**
 * Modal de edição das informações do usuário (entidade, cpf, telefone,
 * setor e função). O botão Salvar só habilita quando há alteração no
 * formulário.
 */
export function EditarUsuarioModal({
  usuario,
  entidades,
  setores,
  funcoes,
  papeis,
  isSaving = false,
  apenasContato = false,
  onClose,
  onSalvar,
}: EditarUsuarioModalProps) {
  const [form, setForm] = useState<FormState>({
    entidadeId: '',
    cpf: '',
    telefone: '',
    setorId: '',
    funcaoId: '',
    papelCodigo: '',
  })

  // Valores iniciais (para detectar alterações e habilitar o Salvar).
  const initial = useMemo<FormState>(
    () => ({
      entidadeId: usuario ? idPorNome(entidades, usuario.entidade ?? '') : '',
      cpf: usuario?.cpf ?? '',
      telefone: usuario?.telefone ?? '',
      setorId: usuario ? idPorNome(setores, usuario.setor) : '',
      funcaoId: usuario ? idPorNome(funcoes, usuario.funcao) : '',
      papelCodigo: usuario?.papelCodigo ?? '',
    }),
    [usuario, entidades, setores, funcoes],
  )

  // Sincroniza o form quando abre com um novo usuário/opções.
  useEffect(() => {
    setForm(initial)
  }, [initial])

  const alterado =
    form.entidadeId !== initial.entidadeId ||
    form.cpf !== initial.cpf ||
    form.telefone !== initial.telefone ||
    form.setorId !== initial.setorId ||
    form.funcaoId !== initial.funcaoId ||
    form.papelCodigo !== initial.papelCodigo

  function handleSalvar() {
    onSalvar({
      entidadeId: form.entidadeId || null,
      cpf: form.cpf.trim() || null,
      telefone: form.telefone.trim() || null,
      setorId: form.setorId || null,
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
          <DialogTitle>{apenasContato ? 'Editar meus dados' : 'Editar usuário'}</DialogTitle>
          <DialogDescription>
            {apenasContato
              ? 'Atualize seu CPF e telefone. Os demais dados dependem do RH/DP.'
              : `Atualize os dados de ${usuario?.nome}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!apenasContato && (
            <div className="flex flex-col gap-2">
              <Label>Entidade</Label>
              <Select
                value={form.entidadeId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, entidadeId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a entidade" />
                </SelectTrigger>
                <SelectContent>
                  {entidades.map((entidade) => (
                    <SelectItem key={entidade.id} value={entidade.id}>
                      {entidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          {!apenasContato && (
            <div className="flex flex-col gap-2">
              <Label>Setor</Label>
              <Select
                value={form.setorId}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, setorId: value }))
                }
              >
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
            </div>
          )}

          {!apenasContato && (
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
          )}

          {!apenasContato && (
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
                  {papeis.map((papel) => (
                    <SelectItem key={papel.codigo} value={papel.codigo}>
                      {papel.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
