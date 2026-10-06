import { useState } from 'react'

import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { AppLayout } from '@/features/app/components/AppLayout'
import type { AppHeaderBreadcrumbItem } from '@/features/app/components/AppHeader'
import { authService } from '@/features/auth/services'
import {
  AtividadesRecentesCard,
  EditarUsuarioModal,
  UsuarioPerfilHeader,
  UsuarioPerfilInfo,
} from '@/features/usuarios/components'
import {
  useOpcoesUsuario,
  usePersonificar,
  usePodeEditarUsuario,
  useUsuario,
} from '@/features/usuarios/hooks'
import type { AtualizarUsuarioInput } from '@/features/usuarios/types'
import { useEntidades } from '@/features/tabelas/hooks'

interface UsuarioPerfilConteudoProps {
  /** Id do usuário a exibir — o próprio (Meu perfil) ou outro (perfil de alguém). */
  usuarioId: string | undefined
  /** Itens de breadcrumb antes do nome do usuário (sempre o último item). */
  breadcrumbBase: AppHeaderBreadcrumbItem[]
  /**
   * Restringe a edição a CPF/telefone — usado quando um COLABORADOR edita o
   * próprio perfil em "Meu perfil": a API bloqueia PATCH /usuarios/:id pra
   * esse papel (só RH/DP/gestor editam o perfil completo de alguém), então
   * o salvamento usa PATCH /auth/me (que qualquer autenticado pode chamar
   * sobre si mesmo).
   */
  apenasContato?: boolean
}

/**
 * Conteúdo da página de perfil de um usuário: cabeçalho, infos, atividades
 * recentes e o modal de edição. Reusado por /usuarios/:id (perfil de
 * alguém, visto pelo RH/DP/gestor — RequireNaoColaborador) e por
 * /meu-perfil (o próprio usuário logado, incluindo COLABORADOR, que não
 * acessa /usuarios/:id). A única diferença entre as duas páginas é o
 * breadcrumb — ver UsuarioPerfil.tsx e MeuPerfil.tsx.
 */
export function UsuarioPerfilConteudo({
  usuarioId,
  breadcrumbBase,
  apenasContato = false,
}: UsuarioPerfilConteudoProps) {
  const { usuario, isLoading, error, atualizarAvatar, atualizarUsuario, recarregar } =
    useUsuario(usuarioId)
  // Dropdowns de entidade/setor/função/papel: pulados quando `apenasContato`
  // (colaborador editando o próprio perfil) — nem aparecem no modal, e a API
  // bloquearia papéis/entidades pra esse papel mesmo.
  const { setores, funcoes, papeis } = useOpcoesUsuario(!apenasContato)
  const { entidades } = useEntidades(!apenasContato)
  const { podePersonificar, personificar } = usePersonificar(usuario)
  // `apenasContato` (colaborador editando o próprio perfil) é uma liberação à
  // parte, sempre válida — fora isso, edição completa nunca vale sobre si
  // mesmo (ver podeEditarUsuario).
  const podeEditarCompleto = usePodeEditarUsuario(usuario)
  const podeEditar = apenasContato || podeEditarCompleto
  const [editando, setEditando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvarEdicao(input: AtualizarUsuarioInput) {
    setSalvando(true)
    try {
      if (apenasContato) {
        await authService.updateMeuPerfil({ telefone: input.telefone })
        await recarregar()
      } else {
        await atualizarUsuario(input)
      }
      setEditando(false)
    } catch (erro) {
      console.error(erro)
    } finally {
      setSalvando(false)
    }
  }

  if (isLoading || !usuario) {
    return (
      <AppLayout title="Usuário" breadcrumbs={[...breadcrumbBase, { label: 'Usuário' }]}>
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
    <AppLayout title={usuario.nome} breadcrumbs={[...breadcrumbBase, { label: usuario.nome }]}>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="shadow-none">
          <CardContent className="flex flex-col gap-6 p-6">
            <UsuarioPerfilHeader
              usuario={usuario}
              onUploadAvatar={atualizarAvatar}
              onEditar={() => setEditando(true)}
              podeEditar={podeEditar}
              podePersonificar={podePersonificar}
              onPersonificar={personificar}
            />
            <Separator />
            <UsuarioPerfilInfo usuario={usuario} />
          </CardContent>
        </Card>

        <AtividadesRecentesCard usuarioId={usuario.id} />
      </div>

      <EditarUsuarioModal
        usuario={editando ? usuario : null}
        entidades={entidades}
        setores={setores}
        funcoes={funcoes}
        papeis={papeis}
        isSaving={salvando}
        apenasContato={apenasContato}
        onClose={() => setEditando(false)}
        onSalvar={handleSalvarEdicao}
      />
    </AppLayout>
  )
}
