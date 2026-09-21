import { Info, Plus, Trash2 } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { NIVEL_CEFR_LABEL, NIVEL_CEFR_PROGRESSO } from '@/lib/cursos'
import type { Idioma, NovoIdiomaInput } from '../types'
import { NewIdiomaModal } from './NewIdiomaModal'

interface IdiomasProps {
  data: Idioma[]
  hideAddButton?: boolean
  onCriar?: (input: NovoIdiomaInput) => Promise<unknown>
  onExcluir?: (id: string) => Promise<unknown> | void
}

function formatarDataAvaliacao(data: string) {
  const [ano, mes, dia] = data.split('-')
  return `${dia}/${mes}/${ano}`
}

export function Idiomas({ data, hideAddButton, onCriar, onExcluir }: IdiomasProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Idiomas</CardTitle>
        {!hideAddButton && onCriar && (
          <NewIdiomaModal onCriar={onCriar}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </NewIdiomaModal>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 pt-4">
        <div className="flex flex-col gap-4">
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum idioma cadastrado.</p>
          )}
          {data.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{item.idioma}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground">
                    {NIVEL_CEFR_LABEL[item.nivelCefr]}
                  </span>
                  {onExcluir && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-red-600"
                      aria-label={`Excluir ${item.idioma}`}
                      onClick={() => onExcluir(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <Progress value={NIVEL_CEFR_PROGRESSO[item.nivelCefr]} className="h-2" />
              {item.origemAvaliacao === 'TESTE_INTERNO' && item.avaliadoEm && (
                <span className="text-xs text-muted-foreground">
                  Avaliado por teste interno em {formatarDataAvaliacao(item.avaliadoEm)}
                </span>
              )}
            </div>
          ))}
        </div>

        {data.some((item) => item.origemAvaliacao === 'AUTODECLARADO') && (
          <Alert className="border-none bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-sm">
              Níveis sem teste interno são autodeclarados pelo colaborador.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
