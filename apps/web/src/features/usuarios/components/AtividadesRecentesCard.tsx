import { Star } from 'lucide-react'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Atividade {
  id: string
  titulo: string
  tempo: string
}

// Mock por enquanto — virá da API (feed de atividades do usuário) futuramente.
const atividadesMock: Atividade[] = [
  { id: '1', titulo: 'Concluiu o projeto "Dashboard UI"', tempo: '2 horas atrás' },
  { id: '2', titulo: 'Atualizou dados cadastrais', tempo: '2 horas atrás' },
  { id: '3', titulo: 'Enviou certificado para validação', tempo: '2 horas atrás' },
]

/**
 * Card lateral com as atividades recentes do usuário no perfil.
 */
export function AtividadesRecentesCard() {
  return (
    <Card className="shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Atividades recentes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {atividadesMock.map((atividade) => (
            <div key={atividade.id} className="flex gap-4 px-6 py-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Star className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-5">{atividade.titulo}</p>
                <p className="text-sm text-muted-foreground">{atividade.tempo}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
