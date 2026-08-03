import { useState } from 'react'

import { AppLayout } from '@/features/app/components'
import {
  AparenciaForm,
  PerfilForm,
  ConfiguracoesNav,
  FeriasPreferenciasForm,
} from '@/features/configuracoes/components'
import type { ConfiguracoesSection } from '@/features/configuracoes/types'
import { useUsuarioLogado } from '@/features/auth/hooks'
import { authService } from '@/features/auth/services'
import { usuariosService } from '@/features/usuarios/services'
import { mascararCpf, mascararTelefone } from '@/lib/masks'

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
 */
export function ConfiguracoesPage() {
  const [secao, setSecao] = useState<ConfiguracoesSection>('perfil')
  const { authUser, usuario, isLoading, recarregar } = useUsuarioLogado()
  const [salvando, setSalvando] = useState(false)

  const nome = usuario?.nome ?? authUser?.nome ?? ''
  const email = usuario?.email ?? authUser?.email ?? ''
  const iniciais = usuario?.iniciais ?? authUser?.iniciais ?? '?'

  async function salvarPerfil(dados: { cpf: string; telefone: string }) {
    setSalvando(true)
    try {
      const soDigitos = (v: string) => v.replace(/\D/g, '') || null
      await authService.updateMeuPerfil({
        cpf: soDigitos(dados.cpf),
        telefone: soDigitos(dados.telefone),
      })
      recarregar()
    } catch (erro) {
      console.error(erro)
    } finally {
      setSalvando(false)
    }
  }

  async function enviarAvatar(blob: Blob) {
    if (!authUser) return
    await usuariosService.uploadAvatar(authUser.id, blob)
    recarregar()
  }

  return (
    <AppLayout
      title="Configurações"
      description="Home / Configurações"
      breadcrumbs={[{ label: 'Configurações' }]}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
        <ConfiguracoesNav active={secao} onSelect={setSecao} />

        <div className="flex-1">
          {secao === 'perfil' &&
            (isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando perfil…</p>
            ) : (
              <PerfilForm
                key={usuario?.id ?? 'perfil'}
                nome={nome}
                email={email}
                fotoUrl={usuario?.fotoUrl}
                iniciais={iniciais}
                cpfInicial={usuario?.cpf ? mascararCpf(usuario.cpf) : ''}
                telefoneInicial={
                  usuario?.telefone ? mascararTelefone(usuario.telefone) : ''
                }
                isSaving={salvando}
                onSalvar={salvarPerfil}
                onUploadAvatar={enviarAvatar}
              />
            ))}
          {secao === 'aparencia' && <AparenciaForm />}
          {secao === 'ferias' && <FeriasPreferenciasForm />}
          {secao === 'conta' && (
            <EmBreve
              titulo="Conta"
              descricao="Dados institucionais (entidade, departamento, admissão)."
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
