import { BookOpen, Eye, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { abrirArquivo } from '@/features/visualizador-arquivo'
import { cursosService } from '../services'
import type { CursoQualificacao, NovoCursoInput } from '../types'
import { NewCursoModal } from './NewCursoModal'

interface CursosWorkshopsProps {
  data: CursoQualificacao[]
  hideAddButton?: boolean
  onCriar?: (input: NovoCursoInput, arquivo?: File | null) => Promise<CursoQualificacao>
  onExcluir?: (id: string) => Promise<unknown> | void
}

function formatarDetalhe(item: CursoQualificacao) {
  const partes = [
    item.instituicao,
    item.cargaHoraria ? `${item.cargaHoraria}h` : null,
    item.dataEmissao ? item.dataEmissao.slice(0, 4) : null,
  ].filter(Boolean)
  return partes.join(' • ')
}

export function CursosWorkshops({ data, hideAddButton, onCriar, onExcluir }: CursosWorkshopsProps) {
  const { toast } = useToast()

  async function verCertificado(item: CursoQualificacao) {
    try {
      const blob = await cursosService.baixarCertificadoCurso(item.id)
      abrirArquivo({ blob, titulo: item.nome })
    } catch (error) {
      toast({
        title: 'Não foi possível abrir o certificado',
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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Cursos e workshops</CardTitle>
        </div>
        {!hideAddButton && onCriar && (
          <NewCursoModal categoria="CURSO_WORKSHOP" onCriar={onCriar}>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </NewCursoModal>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum curso/workshop cadastrado.</p>
        )}
        {data.map((item, index) => (
          <div key={item.id} className="flex flex-col">
            <div className="flex items-center justify-between py-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{item.nome}</span>
                <span className="text-sm text-muted-foreground">{formatarDetalhe(item)}</span>
              </div>
              <div className="flex items-center gap-1">
                {item.certificadoUrl && (
                  <Button
                    variant="link"
                    className="h-8 gap-1 font-semibold text-brand dark:text-blue-400"
                    onClick={() => verCertificado(item)}
                  >
                    <Eye className="h-4 w-4" />
                    Ver certificado
                  </Button>
                )}
                {onExcluir && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-red-600"
                    aria-label={`Excluir ${item.nome}`}
                    onClick={() => onExcluir(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            {index < data.length - 1 && <Separator className="mt-2" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
