import { Download, FileQuestion } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  fecharVisualizadorArquivo,
  useVisualizadorArquivoEstado,
} from '@/features/visualizador-arquivo/lib/visualizadorArquivoStore'

/**
 * Dialog universal de visualização de arquivo — pré-visualiza imagem e PDF
 * inline; os demais tipos caem num botão de baixar. Montado UMA VEZ na raiz
 * do app (ver App.tsx); qualquer módulo abre chamando `abrirArquivo()`
 * (lib/visualizadorArquivoStore.ts), sem precisar de contexto/provider.
 */
export function VisualizadorArquivoDialog() {
  const { aberto, objectUrl, tipo, titulo } = useVisualizadorArquivoEstado()

  return (
    <Dialog
      open={aberto}
      onOpenChange={(open) => {
        if (!open) fecharVisualizadorArquivo()
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {titulo ?? 'Visualizar arquivo'}
          </DialogTitle>
        </DialogHeader>

        {objectUrl && tipo === 'imagem' ? (
          <img
            src={objectUrl}
            alt={titulo ?? 'Arquivo'}
            className="max-h-[75vh] w-full rounded-md border object-contain"
          />
        ) : objectUrl && tipo === 'pdf' ? (
          <iframe
            src={objectUrl}
            title={titulo ?? 'Arquivo'}
            className="h-[75vh] w-full rounded-md border"
          />
        ) : objectUrl ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <FileQuestion className="h-10 w-10" />
            <p>Não é possível pré-visualizar este tipo de arquivo.</p>
            <Button asChild size="sm">
              <a href={objectUrl} download={titulo ?? undefined}>
                <Download className="h-4 w-4" />
                Baixar arquivo
              </a>
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
