import { useEffect, useState } from 'react'
import { Eye } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { vrService } from '@/features/vr/services'
import type { PreVisualizacaoResultado, VrMes } from '@/features/vr/types'

interface PreVisualizacaoDialogProps {
  vrMes: VrMes
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Iniciais (primeiro + último nome) para o fallback do avatar. */
function gerarIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Dialog "Pré-visualizar": mostra o que o fechamento geraria pra cada
 * colaborador (dias, desconto, extra, valor final) SEM fechar de verdade —
 * pra conferir antes de aplicar. Não grava nada no banco.
 */
export function PreVisualizacaoDialog({ vrMes }: PreVisualizacaoDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [resultado, setResultado] = useState<PreVisualizacaoResultado | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setCarregando(true)
    setErro(null)
    vrService
      .preVisualizar(vrMes.id)
      .then(setResultado)
      .catch((error) => setErro(error instanceof Error ? error.message : 'Falha ao carregar.'))
      .finally(() => setCarregando(false))
  }, [aberto, vrMes.id])

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Eye className="h-4 w-4" />
          Pré-visualizar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Pré-visualização — {vrMes.mes}/{vrMes.ano}
          </DialogTitle>
          <DialogDescription>
            Isso é uma simulação: mostra o que o fechamento geraria, sem fechar de verdade
            nem aplicar nenhum lançamento ainda.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <p className="p-4 text-sm text-muted-foreground">Calculando...</p>
        ) : erro ? (
          <p className="p-4 text-sm text-destructive">{erro}</p>
        ) : resultado ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Total Bruto</p>
                <p className="font-semibold">{formatarMoeda(resultado.totalBruto)}</p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Descontos</p>
                <p className="font-semibold text-destructive">
                  -{formatarMoeda(resultado.totalDescontos)}
                </p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Valor Final</p>
                <p className="font-semibold text-emerald-600">
                  {formatarMoeda(resultado.valorFinal)}
                </p>
              </div>
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Colaboradores</p>
                <p className="font-semibold">{resultado.colaboradores}</p>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-md border">
              {resultado.itens.map((item) => (
                <div
                  key={item.userId}
                  className="flex items-center justify-between gap-3 border-b p-3 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {gerarIniciais(item.userNome)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.userNome}</p>
                      <p className="text-xs text-muted-foreground">{item.userEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">Dias: {item.diasVr}</span>
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive">
                      -{item.qtdDesconto}
                    </span>
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600">
                      +{item.qtdExtra}
                    </span>
                    <span className="w-20 text-right font-semibold">
                      {formatarMoeda(item.valorAReceber)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
