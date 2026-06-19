import { useParams } from 'react-router-dom'
import { Star } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AppLayout } from '@/features/app/components/AppLayout'
import { usuarios } from '@/features/usuarios/data/usuarios'

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
 * Página de detalhe de um usuário selecionado na listagem.
 */
export function UsuarioDetail() {
  const { usuarioId } = useParams()
  const usuario = usuarios.find((item) => item.id === usuarioId)

  if (!usuario) {
    return (
      <AppLayout
        title="Usuário"
        description="Home / Gestão de Pessoas / Usuários"
        breadcrumbs={[
          { label: 'Usuários', href: '/usuarios' },
          { label: 'Usuário' },
        ]}
      >
        <p className="text-sm text-muted-foreground">Usuário não encontrado.</p>
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
          <CardContent className="flex min-h-[320px] items-start p-6">
            <Avatar className="h-24 w-24 rounded-lg">
              <AvatarImage
                src={usuario.fotoUrl}
                alt={usuario.nome}
                className="rounded-lg"
              />
              <AvatarFallback className="rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                {usuario.iniciais}
              </AvatarFallback>
            </Avatar>
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
    </AppLayout>
  )
}
