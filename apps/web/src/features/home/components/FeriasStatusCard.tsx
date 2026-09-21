import { useNavigate } from 'react-router-dom'
import { Palmtree } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FeriasStatusMock } from '../types'

/**
 * Card de status de férias do colaborador logado. Suporta os dois estados:
 *   - `diasParaFerias` preenchido → já tem férias aprovadas chegando.
 *   - `diasParaFerias` null → ainda não solicitou férias pro ciclo vigente
 *     (mesma ideia da obrigação recorrente OBRIGACAO_FERIAS_SOLICITAR do
 *     back — ver lib/obrigacoes.ts — quando isso for ligado na API real).
 */
export function FeriasStatusCard({ diasParaFerias, periodo }: FeriasStatusMock) {
  const navigate = useNavigate()
  const temFeriasAgendada = diasParaFerias !== null

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
          <Palmtree className="h-5 w-5" />
        </div>
        <CardTitle className="text-lg">Férias</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {temFeriasAgendada ? (
          <>
            <p className="text-2xl font-bold tracking-tight">
              Você sai de férias em {diasParaFerias} {diasParaFerias === 1 ? 'dia' : 'dias'}
            </p>
            {periodo && (
              <p className="mt-1 text-sm text-muted-foreground">Período: {periodo}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              Você ainda não solicitou férias
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Solicite pra garantir seu período aquisitivo vigente.
            </p>
            <Button size="sm" className="mt-3" onClick={() => navigate('/ferias')}>
              Solicitar férias
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
