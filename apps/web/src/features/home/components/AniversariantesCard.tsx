import { PartyPopper } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Aniversariante } from '../types'

interface AniversariantesCardProps {
  aniversariantes: Aniversariante[]
}

/** Card com os aniversariantes do mês. */
export function AniversariantesCard({ aniversariantes }: AniversariantesCardProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400">
          <PartyPopper className="h-5 w-5" />
        </div>
        <CardTitle className="text-lg">Aniversariantes do mês</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-2">
        {aniversariantes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ninguém faz aniversário este mês.</p>
        ) : (
          aniversariantes.map((pessoa) => (
            <div key={pessoa.id} className="flex items-center gap-3">
              <Avatar className="h-9 w-9 rounded-lg">
                <AvatarImage src={pessoa.fotoUrl} alt={pessoa.nome} className="rounded-lg" />
                <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                  {pessoa.iniciais}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate text-sm font-medium leading-none">{pessoa.nome}</span>
                <span className="text-xs text-muted-foreground">{pessoa.data}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
