import { AlertTriangle, Coffee, FileText, GraduationCap, Paperclip, type LucideIcon } from 'lucide-react'

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
  folga: Coffee,
}

interface AtividadesRecentesCardProps {
  /** Id do usuário cujas atividades serão listadas. */
  usuarioId: string | undefined
}

/**
 * Card lateral com as atividades recentes do usuário no perfil — o que ELE
 * fez no sistema (aprovou/recusou/solicitou algo) E o que aconteceu pra ele
 * (uma decisão de outra pessoa, ex.: "Ana aprovou sua formação acadêmica").
 * Vem da mesma tabela de notificações (ver
 * lib/notificacoes.ts#listAtividadesUsuario). Vendo o perfil de outra pessoa,
 * o backend já filtra pra só trazer atividades com RH/DP envolvido.
 *
 * As frases de `acao` são escritas na 2ª pessoa em relação ao dono do perfil
 * (ex.: "confirmou suas férias"), então: quando `euFizFoi` é true, a frase já
 * lê corretamente sozinha ("confirmou suas férias" — de quem, mostrado embaixo);
 * quando é false, a contraparte vira sujeito da frase ("Ana confirmou suas
 * férias").
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
                      {atividade.euFizFoi ? '' : `${atividade.contraparteNome} `}
                      {atividade.acao}
                      {atividade.detalhe ? ` — ${atividade.detalhe}` : ''}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {atividade.euFizFoi
                        ? `${atividade.contraparteNome} • ${atividade.tempo}`
                        : atividade.tempo}
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
