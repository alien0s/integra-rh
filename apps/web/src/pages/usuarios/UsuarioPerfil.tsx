import { useState } from 'react'
import { useParams } from 'react-router-dom'

import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AppLayout } from '@/features/app/components/AppLayout'
import {
  AtividadesRecentesCard,
  EditarUsuarioModal,
  UsuarioPerfilHeader,
  UsuarioPerfilInfo,
} from '@/features/usuarios/components'
import {
  useOpcoesUsuario,
  usePersonificar,
  useUsuario,
} from '@/features/usuarios/hooks'

/**
 * Página de perfil de um usuário. Orquestra os dados (hooks) e compõe os
 * componentes da feature (cabeçalho, infos, atividades e modal de edição).
 */
export function UsuarioPerfil() {
  const { usuarioId } = useParams()
  // Dados do usuário vêm da API (tabela users com JOINs).
  const { usuario, isLoading, error, atualizarAvatar, atualizarUsuario } =
    useUsuario(usuarioId)
  const { departamentos, funcoes } = useOpcoesUsuario()
  const { podePersonificar, personificar } = usePersonificar(usuario)
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvarEdicao(input: Parameters<typeof atualizarUsuario>[0]) {
    setSalvando(true)
    try {
      await atualizarUsuario(input)
      setEditando(false)
    } catch (erro) {
      console.error(erro)
    } finally {
      setSalvando(false)
    }
  }

  if (isLoading || !usuario) {
    return (
      <AppLayout
        title="Usuário"
        description="Home / Gestão de Pessoas / Usuários"
        breadcrumbs={[
          { label: 'Usuários', href: '/usuarios' },
          { label: 'Usuário' },
        ]}
      >
        <p className="text-sm text-muted-foreground">
          {error
            ? error
            : isLoading
              ? 'Carregando usuário…'
              : 'Usuário não encontrado.'}
        </p>
      </AppLayout>
    )
  }

  return (
    <AppLayout
      title={usuario.nome}
      description="Home / Gestão de Pessoas / Usuários"
      breadcrumbs={[
        { label: 'Usuários', href: '/usuarios' },
        { label: usuario.nome },
      ]}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-6 p-6">
            <UsuarioPerfilHeader
              usuario={usuario}
              onUploadAvatar={atualizarAvatar}
              onEditar={() => setEditando(true)}
              podePersonificar={podePersonificar}
              onPersonificar={personificar}
            />
            <Separator />
            <UsuarioPerfilInfo usuario={usuario} />
          </CardContent>
        </Card>

        <AtividadesRecentesCard />
      </div>

      <EditarUsuarioModal
        usuario={editando ? usuario : null}
        departamentos={departamentos}
        funcoes={funcoes}
        isSaving={salvando}
        onClose={() => setEditando(false)}
        onSalvar={handleSalvarEdicao}
      />
    </AppLayout>
  )
}
