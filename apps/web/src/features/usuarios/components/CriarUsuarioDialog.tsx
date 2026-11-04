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
import type { Papel } from '@/features/tabelas/types'

/** Rótulo de exibição do tipo de vínculo — mesmos códigos da coluna users.tipo_funcionario. */
const TIPO_FUNCIONARIO_LABEL: Record<string, string> = {
  COLABORADOR: 'Colaborador',
  'APRENDIZ/ESTAGIÁRIO': 'Aprendiz/Estagiário',
}
const TIPOS_FUNCIONARIO = Object.keys(TIPO_FUNCIONARIO_LABEL)

interface CriarUsuarioDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entidades: OpcaoSelecao[]
  setores: OpcaoSelecao[]
  papeis: Papel[]
  /** Chamado após criar com sucesso (para recarregar a lista). */
  onCriado?: () => void
}

/** Estado do formulário de criação. */
interface FormState {
  nome: string
  email: string
  entidadeId: string
  setorId: string
  papelCodigo: string
  tipoFuncionario: string
}

const formVazio: FormState = {
  nome: '',
  email: '',
  entidadeId: '',
  setorId: '',
  papelCodigo: '',
  tipoFuncionario: '',
}

/**
 * Dialog para o ADMIN criar um usuário com cadastro já completo (nome,
 * e-mail, entidade, setor, papel e tipo de vínculo) — ação restrita a ADMIN
 * tanto aqui (quem abre o gatilho decide a visibilidade, ver
 * UsuariosTableActions.tsx) quanto na API (`POST /usuarios`, exigirPapeis()
 * sem argumentos = só ADMIN). Os demais dados (cpf, telefone, datas,
 * salário...) vêm do legado no 1º login dessa pessoa — login é sempre via
 * LDAP/AD, nunca por senha local, então criar aqui não substitui a conta de
 * rede: só prepara o cadastro pra quando ela entrar pela 1ª vez.
 */
export function CriarUsuarioDialog({
  open,
  onOpenChange,
  entidades,
  setores,
  papeis,
  onCriado,
}: CriarUsuarioDialogProps) {
  const [form, setForm] = useState<FormState>(formVazio)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  function resetar() {
    setForm(formVazio)
    setErro(null)
  }

  async function handleSalvar() {
    setSalvando(true)
    setErro(null)
    try {
      await usuariosService.criarUsuario({
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        entidadeId: form.entidadeId,
        setorId: form.setorId,
        roleCodigo: form.papelCodigo,
        tipoFuncionario: form.tipoFuncionario,
      })
      onCriado?.()
      resetar()
      onOpenChange(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar usuário.')
    } finally {
      setSalvando(false)
    }
  }

  const podeSalvar =
    form.nome.trim().length > 0 &&
    form.email.trim().length > 0 &&
    Boolean(form.entidadeId) &&
    Boolean(form.setorId) &&
    Boolean(form.papelCodigo) &&
    Boolean(form.tipoFuncionario)

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
          <DialogTitle>Criar usuário</DialogTitle>
          <DialogDescription>
            O login continua sendo pela conta de rede (LDAP/AD) — isto só
            prepara o cadastro, com os dados abaixo já preenchidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="criar-usuario-nome">Nome</Label>
            <Input
              id="criar-usuario-nome"
              value={form.nome}
              onChange={(event) =>
                setForm((f) => ({ ...f, nome: event.target.value }))
              }
              placeholder="Nome completo"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="criar-usuario-email">E-mail</Label>
            <Input
              id="criar-usuario-email"
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((f) => ({ ...f, email: event.target.value }))
              }
              placeholder="nome@adventistas.org"
            />
          </div>

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

          <div className="flex flex-col gap-2">
            <Label>Tipo de vínculo</Label>
            <Select
              value={form.tipoFuncionario}
              onValueChange={(value) =>
                setForm((f) => ({ ...f, tipoFuncionario: value }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de vínculo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_FUNCIONARIO.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>
                    {TIPO_FUNCIONARIO_LABEL[tipo]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {salvando ? 'Criando…' : 'Criar usuário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
