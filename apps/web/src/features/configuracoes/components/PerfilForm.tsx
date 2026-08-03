import { useState } from 'react'

import { AvatarUploader } from '@/components/RH'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

import { mascararCpf, mascararTelefone } from '@/lib/masks'

interface PerfilFormProps {
  /** Nome (somente leitura — vem do cadastro oficial / SQL Server). */
  nome: string
  /** E-mail (somente leitura — vem do login). */
  email: string
  /** URL da foto atual (já resolvida). */
  fotoUrl?: string
  /** Iniciais para o fallback do avatar. */
  iniciais: string
  /** CPF já mascarado para exibição. */
  cpfInicial: string
  /** Telefone já mascarado para exibição. */
  telefoneInicial: string
  isSaving?: boolean
  onSalvar: (dados: { cpf: string; telefone: string }) => void
  onUploadAvatar: (blob: Blob) => Promise<void> | void
}

/**
 * Formulário de perfil do próprio usuário. Nome/e-mail são somente leitura
 * (vêm do cadastro/login); edita CPF, telefone e a foto. O botão só habilita
 * quando há alteração nos campos editáveis.
 */
export function PerfilForm({
  nome,
  email,
  fotoUrl,
  iniciais,
  cpfInicial,
  telefoneInicial,
  isSaving = false,
  onSalvar,
  onUploadAvatar,
}: PerfilFormProps) {
  const [cpf, setCpf] = useState(cpfInicial)
  const [telefone, setTelefone] = useState(telefoneInicial)

  const alterado = cpf !== cpfInicial || telefone !== telefoneInicial

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
            src={fotoUrl}
            nome={nome}
            iniciais={iniciais}
            className="h-20 w-20"
            onUpload={onUploadAvatar}
            withActions
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} disabled />
          <p className="text-xs text-muted-foreground">
            Vem do cadastro oficial — não pode ser alterado aqui.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" value={email} disabled />
          <p className="text-xs text-muted-foreground">
            Gerenciado pelo login — não pode ser alterado aqui.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            value={cpf}
            inputMode="numeric"
            maxLength={14}
            onChange={(e) => setCpf(mascararCpf(e.target.value))}
            placeholder="000.000.000-00"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            value={telefone}
            inputMode="tel"
            maxLength={19}
            onChange={(e) => setTelefone(mascararTelefone(e.target.value))}
            placeholder="+55 (00) 00000-0000"
          />
        </div>

        <div>
          <Button
            size="sm"
            disabled={!alterado || isSaving}
            onClick={() => onSalvar({ cpf, telefone })}
          >
            {isSaving ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
