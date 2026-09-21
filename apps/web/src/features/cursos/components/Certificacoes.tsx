import { Award, Eye, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { abrirAnexoBlob } from '@/lib/cursos'
import { cursosService } from '../services'
import type { CursoQualificacao, NovoCursoInput } from '../types'
import { NewCursoModal } from './NewCursoModal'

interface CertificacoesProps {
  data: CursoQualificacao[]
  hideAddButton?: boolean
  onCriar?: (input: NovoCursoInput, arquivo?: File | null) => Promise<CursoQualificacao>
  onExcluir?: (id: string) => Promise<unknown> | void
}

function formatarValidade(dataEmissao: string | null, dataValidade: string | null) {
  if (dataValidade) {
    const [ano, mes] = dataValidade.split('-')
    return `Expira em ${mes}/${ano}`
  }
  if (dataEmissao) {
    return `Emitido em ${dataEmissao.slice(0, 4)}`
  }
  return 'Sem data informada'
}

export function Certificacoes({ data, hideAddButton, onCriar, onExcluir }: CertificacoesProps) {
  const { toast } = useToast()

  async function verCertificado(item: CursoQualificacao) {
    try {
      const blob = await cursosService.baixarCertificadoCurso(item.id)
      abrirAnexoBlob(blob)
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
            <Award className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Certificações</CardTitle>
        </div>
        {!hideAddButton && onCriar && (
          <NewCursoModal categoria="CERTIFICACAO" onCriar={onCriar}>
            <Button variant="outline" size="sm" className="h-8 gap-1">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </NewCursoModal>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma certificação cadastrada.</p>
        )}
        {data.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center rounded-full border p-2">
                <Award className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">{item.nome}</span>
                <span className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {item.instituicao} • {formatarValidade(item.dataEmissao, item.dataValidade)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {item.certificadoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  aria-label={`Ver certificado de ${item.nome}`}
                  onClick={() => verCertificado(item)}
                >
                  <Eye className="h-4 w-4" />
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
        ))}
      </CardContent>
    </Card>
  )
}
