import { useState } from 'react'

import { AppLayout } from '@/features/app/components'
import {
  AparenciaForm,
  ConfiguracoesNav,
} from '@/features/configuracoes/components'
import type { ConfiguracoesSection } from '@/features/configuracoes/types'

/** Placeholder para seções ainda não implementadas. */
function EmBreve({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-lg font-medium">{titulo}</h3>
      <p className="text-sm text-muted-foreground">{descricao}</p>
      <p className="mt-6 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Em breve.
      </p>
    </div>
  )
}

/**
 * Página de Configurações. Nav lateral seleciona a seção exibida à direita.
 * O perfil do usuário (nome, foto, cpf, telefone) mudou pra /meu-perfil —
 * ver MeuPerfil.tsx.
 */
export function ConfiguracoesPage() {
  const [secao, setSecao] = useState<ConfiguracoesSection>('aparencia')

  return (
    <AppLayout
      title="Configurações"
      description="Home / Configurações"
      breadcrumbs={[{ label: 'Configurações' }]}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <ConfiguracoesNav active={secao} onSelect={setSecao} />

        <div className="flex-1">
          {secao === 'aparencia' && <AparenciaForm />}
          {secao === 'conta' && (
            <EmBreve
              titulo="Conta"
              descricao="Dados institucionais (entidade, setor, admissão)."
            />
          )}
          {secao === 'notificacoes' && (
            <EmBreve
              titulo="Notificações"
              descricao="Configure como e quando você recebe avisos."
            />
          )}
          {secao === 'exibicao' && (
            <EmBreve
              titulo="Exibição"
              descricao="Ajuste o que aparece nas telas e listagens."
            />
          )}
        </div>
      </div>
    </AppLayout>
  )
}
