import { Plus, StickyNote as StickyNoteCheck, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { CURSOS_STYLES, formatarTituloFormacao } from '@/lib/cursos'
import { abrirArquivo } from '@/features/visualizador-arquivo'
import { cursosService } from '../services'
import type { FormacaoAcademica as FormacaoAcademicaType, NovaFormacaoInput } from '../types'
import { NewGraduacaoModal } from './NewGraduacaoModal'

interface FormacaoAcademicaProps {
  data: FormacaoAcademicaType[]
  hideAddButton?: boolean
  onCriar?: (input: NovaFormacaoInput, arquivo?: File | null) => Promise<FormacaoAcademicaType>
  onExcluir?: (id: string) => Promise<unknown> | void
}

const SITUACAO_LABEL: Record<FormacaoAcademicaType['situacao'], string> = {
  EM_ANDAMENTO: 'EM ANDAMENTO',
  CONCLUIDO: 'CONCLUÍDO',
  TRANCADO: 'TRANCADO',
}

function formatarPeriodo(anoInicio: number, anoFim: number | null) {
  return `${anoInicio} - ${anoFim ?? 'Presente'}`
}

export function FormacaoAcademica({
  data,
  hideAddButton,
  onCriar,
  onExcluir,
}: FormacaoAcademicaProps) {
  const { toast } = useToast()

  async function verDiploma(item: FormacaoAcademicaType) {
    try {
      const blob = await cursosService.baixarAnexoFormacao(item.id)
      abrirArquivo({ blob, titulo: formatarTituloFormacao(item.nivel, item.curso) })
    } catch (error) {
      toast({
        title: 'Não foi possível abrir o diploma',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
        duration: 4000,
      })
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg">Formação acadêmica</CardTitle>
        </div>
        {!hideAddButton && onCriar && (
          <NewGraduacaoModal onCriar={onCriar}>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </NewGraduacaoModal>
        )}
      </CardHeader>
      <CardContent className="grid gap-6 pt-4">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma formação cadastrada.</p>
        )}
        {data.map((item, index) => (
          <div key={item.id} className="flex flex-col gap-6">
            <div className="flex gap-4">
              <div>
                {item.situacao === 'EM_ANDAMENTO' ? (
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
                  <span className="font-semibold">
                    {formatarTituloFormacao(item.nivel, item.curso)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {item.instituicao} • {formatarPeriodo(item.anoInicio, item.anoFim)}
                  </span>
                  <div className="mt-1 flex gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        item.situacao === 'CONCLUIDO'
                          ? 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'
                          : item.situacao === 'TRANCADO'
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300'
                            : 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
                      }
                    >
                      {SITUACAO_LABEL[item.situacao]}
                    </Badge>
                    {item.anexoUrl && (
                      <Badge
                        variant="secondary"
                        className="bg-gray-100 text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300"
                      >
                        Diploma anexado
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.anexoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      aria-label={`Visualizar diploma de ${item.curso}`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        verDiploma(item)
                      }}
                    >
                      <StickyNoteCheck className="h-4 w-4" />
                    </Button>
                  )}
                  {onExcluir && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-red-600"
                      aria-label={`Excluir ${item.curso}`}
                      onClick={() => onExcluir(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {index < data.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
