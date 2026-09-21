import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ExcecoesFeriasAdmin } from './ExcecoesFeriasAdmin'

/**
 * Diálogo (DP/COORDENADOR DP/ADMIN) com a tabela de exceções de férias:
 * libera, por colaborador, fracionar em até 2 períodos de 10 a 15 dias e/ou
 * vender até 10 dias (abono). Os dados só são buscados quando o diálogo é
 * aberto (o `<Dialog>` desmonta o conteúdo enquanto fechado).
 */
export function ExcecoesFeriasDialog() {
  const [aberto, setAberto] = useState(false)

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ShieldCheck className="h-4 w-4" />
          Exceções
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Exceções de férias</DialogTitle>
          <DialogDescription>
            Libere, por colaborador, o fracionamento (até 2 períodos de 10 a 15
            dias) e/ou a venda de dias (abono pecuniário, até 10 dias).
          </DialogDescription>
        </DialogHeader>

        <ExcecoesFeriasAdmin />
      </DialogContent>
    </Dialog>
  )
}
