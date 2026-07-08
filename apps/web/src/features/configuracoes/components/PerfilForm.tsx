import { useState } from 'react'

import { AvatarUploader } from '@/components/RH'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

import type { PerfilFormData } from '@/features/configuracoes/types'
import { mascararCpf, mascararTelefone } from '@/lib/masks'

/** Deriva as iniciais (primeiro + último nome) para o fallback do avatar. */
function gerarIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : ''
  return `${primeira}${ultima}`.toUpperCase()
}

interface PerfilFormProps {
  /** E-mail do usuário (somente leitura — vem do login Microsoft). */
  email?: string
  /** Valores iniciais do formulário. */
  initial?: PerfilFormData
  onSalvar?: (dados: PerfilFormData) => void
}

const VAZIO: PerfilFormData = { nome: '', cpf: '', telefone: '' }

/**
 * Formulário de perfil do próprio usuário (campos da tabela users).
 * O botão só habilita quando há alteração.
 */
export function PerfilForm({
  email = '',
  initial = VAZIO,
  onSalvar,
}: PerfilFormProps) {
  const [form, setForm] = useState<PerfilFormData>(initial)

  const alterado =
    form.nome !== initial.nome ||
    form.cpf !== initial.cpf ||
    form.telefone !== initial.telefone

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium">Perfil</h3>
        <p className="text-sm text-muted-foreground">
          É assim que os outros verão você no sistema.
        </p>
      </div>
      <Separator />

      <div className="flex max-w-xl flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label>Foto</Label>
          <AvatarUploader
            nome={form.nome}
            iniciais={gerarIniciais(form.nome)}
            className="h-20 w-20"
            withActions
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            placeholder="Seu nome completo"
          />
          <p className="text-xs text-muted-foreground">
            Nome exibido para os demais usuários do sistema.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={email} disabled />
          <p className="text-xs text-muted-foreground">
            Gerenciado pelo login Microsoft — não pode ser alterado aqui.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            value={form.cpf}
            inputMode="numeric"
            maxLength={14}
            onChange={(e) =>
              setForm((f) => ({ ...f, cpf: mascararCpf(e.target.value) }))
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
            onChange={(e) =>
              setForm((f) => ({ ...f, telefone: mascararTelefone(e.target.value) }))
            }
            placeholder="+55 (00) 00000-0000"
          />
        </div>

        <div>
          <Button
            size="sm"
            disabled={!alterado}
            onClick={() => onSalvar?.(form)}
          >
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  )
}
