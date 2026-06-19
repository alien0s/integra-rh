import { Plus, StickyNote as StickyNoteCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { CURSOS_STYLES } from '@/lib/cursos'
import type { FormacaoAcademica as FormacaoAcademicaType } from '../types'
import { NewGraduacaoModal } from './NewGraduacaoModal'

interface FormacaoAcademicaProps {
  data: FormacaoAcademicaType[]
  hideAddButton?: boolean
}

export function FormacaoAcademica({
  data,
  hideAddButton,
}: FormacaoAcademicaProps) {
  const { toast } = useToast()

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Formação acadêmica</CardTitle>
        </div>
        {!hideAddButton && (
          <NewGraduacaoModal>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </NewGraduacaoModal>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 pt-4">
        {data.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-6">
            <div className="flex gap-4">
              <div>
                {item.status === 'EM ANDAMENTO' ? (
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${CURSOS_STYLES.EM_FORMACAO.bgClass} ${CURSOS_STYLES.EM_FORMACAO.textClass}`}
                  >
                    <CURSOS_STYLES.EM_FORMACAO.icon className="h-5 w-5" />
                  </div>
                ) : (
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${CURSOS_STYLES.FORMADOS.bgClass} ${CURSOS_STYLES.FORMADOS.textClass}`}
                  >
                    <CURSOS_STYLES.FORMADOS.icon className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">{item.curso}</span>
                  <span className="text-sm text-muted-foreground">
                    {item.instituicao} • {item.periodo}
                  </span>
                  <div className="mt-1 flex gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        item.status === 'CONCLUÍDO'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
                      }
                    >
                      {item.status}
                    </Badge>
                    {item.verificado && (
                      <Badge
                        variant="secondary"
                        className="bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Diploma verificado
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  aria-label={`Visualizar diploma de ${item.curso}`}
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    toast({
                      title: 'Diploma de nível superior',
                      description:
                        'A visualização do diploma ainda não está disponível.',
                      duration: 4000,
                    })
                  }}
                >
                  <StickyNoteCheck className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {index < data.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
