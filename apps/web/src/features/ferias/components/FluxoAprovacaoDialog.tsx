import { useState } from 'react'
import { Workflow } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FluxoAprovacaoAdmin } from './FluxoAprovacaoAdmin'

/**
 * Diálogo ADMIN com a tela de configuração do fluxo de aprovação de férias
 * (exceções por grupo de entidade). Os dados só são buscados quando o
 * diálogo é aberto (o `<Dialog>` desmonta o conteúdo enquanto fechado) —
 * mesmo padrão de ExcecoesFeriasDialog.tsx.
 */
export function FluxoAprovacaoDialog() {
  const [aberto, setAberto] = useState(false)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Workflow className="h-4 w-4" />
          Fluxo de aprovação
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] w-[calc(100%-2rem)] flex-col sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Fluxo de aprovação</DialogTitle>
          <DialogDescription>
            Configure exceções ao fluxo padrão de aprovação de férias por grupo de entidade
            (ex.: secretárias que respondem por mais de um setor).
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
          <FluxoAprovacaoAdmin />
        </div>
      </DialogContent>
    </Dialog>
  )
}
