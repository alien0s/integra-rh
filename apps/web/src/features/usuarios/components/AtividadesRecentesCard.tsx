import { AlertTriangle, FileText, GraduationCap, Paperclip, type LucideIcon } from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAtividadesUsuario } from '@/features/usuarios/hooks'
import type { AtividadeUsuario } from '@/features/usuarios/types'

/** Ícone do card conforme o tipo da atividade (mesmo mapa das notificações). */
const iconePorTipo: Record<AtividadeUsuario['icone'], LucideIcon> = {
  arquivo: Paperclip,
  documento: FileText,
  curso: GraduationCap,
  obrigacao: AlertTriangle,
}

interface AtividadesRecentesCardProps {
  /** Id do usuário cujas atividades serão listadas. */
  usuarioId: string | undefined
}

/**
 * Card lateral com as atividades recentes do usuário no perfil — ações que
 * ELE realizou no sistema (aprovou/recusou/solicitou algo), não notificações
 * que recebeu. Vem da mesma tabela de notificações (ver
 * lib/notificacoes.ts#listAtividadesUsuario), filtrada por quem foi o ator.
 */
export function AtividadesRecentesCard({ usuarioId }: AtividadesRecentesCardProps) {
  const { atividades, isLoading, error } = useAtividadesUsuario(usuarioId)

  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Atividades recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">Carregando…</p>
        ) : error ? (
          <p className="px-6 py-5 text-sm text-destructive">{error}</p>
        ) : atividades.length === 0 ? (
          <p className="px-6 py-5 text-sm text-muted-foreground">
            Nenhuma atividade recente.
          </p>
        ) : (
          <div className="divide-y">
            {atividades.map((atividade) => {
              const Icone = iconePorTipo[atividade.icone]
              return (
                <div key={atividade.id} className="flex gap-4 px-6 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5">
                      {atividade.acao}
                      {atividade.detalhe ? ` — ${atividade.detalhe}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {atividade.destinatarioNome} • {atividade.tempo}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
