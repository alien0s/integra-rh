import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Pencil, Star } from 'lucide-react'

import { AvatarUploader } from '@/components/RH'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AppLayout } from '@/features/app/components/AppLayout'
import { EditarUsuarioModal, UsuarioPerfilInfo } from '@/features/usuarios/components'
import { useOpcoesUsuario, useUsuario } from '@/features/usuarios/hooks'

const statusClassName = {
  Ativo:
    'border-transparent bg-emerald-100 text-emerald-600 hover:bg-emerald-100',
  Inativo: 'border-transparent bg-red-50 text-red-500 hover:bg-red-50',
}

const recentActivities = [
  {
    id: '1',
    title: 'Concluiu o projeto "Dashboard UI"',
    time: '2 horas atrás',
  },
  {
    id: '2',
    title: 'Atualizou dados cadastrais',
    time: '2 horas atrás',
  },
  {
    id: '3',
    title: 'Enviou certificado para validação',
    time: '2 horas atrás',
  },
]

/**
 * Página de perfil de um usuário, com seus dados cadastrais e atividades.
 */
export function UsuarioPerfil() {
  const { usuarioId } = useParams()
  // Dados do usuário vêm da API (tabela users com JOINs).
  const { usuario, isLoading, error, atualizarAvatar, atualizarUsuario } =
    useUsuario(usuarioId)
  const { departamentos, funcoes } = useOpcoesUsuario()
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
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <AvatarUploader
                  src={usuario.fotoUrl}
                  nome={usuario.nome}
                  iniciais={usuario.iniciais}
                  className="h-24 w-24"
                  onUpload={atualizarAvatar}
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-xl font-semibold leading-tight">
                    {usuario.nome}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {usuario.funcao} • {usuario.departamento}
                  </p>
                  <Badge
                    variant="outline"
                    className={`mt-1 w-fit justify-center rounded-lg px-2 py-1 text-xs font-medium shadow-none ${statusClassName[usuario.status]}`}
                  >
                    {usuario.status}
                  </Badge>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="self-center"
                onClick={() => setEditando(true)}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            </div>

            <Separator />

            <UsuarioPerfilInfo usuario={usuario} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex gap-4 px-6 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Star className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5">
                      {activity.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
