import { useState } from 'react'
import { ChevronDown, Download, Lock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { EditarVrMesDialog } from './EditarVrMesDialog'
import { FecharPorEntidadeDialog } from './FecharPorEntidadeDialog'
import { LancamentosVrDialog } from './LancamentosVrDialog'
import { vrService } from '@/features/vr/services'
import type { ColaboradorOpcao, EntidadeOpcao, FormatoExportacaoVr, VrMes } from '@/features/vr/types'

interface VrMesCardProps {
  vrMes: VrMes
  colaboradores: ColaboradorOpcao[]
  entidades: EntidadeOpcao[]
  /** Chamado depois de editar ou fechar uma entidade — recarrega a lista de meses. */
  onAtualizado: () => Promise<void>
  /** Mostra o grupo (campo) do mês no cabeçalho — útil pro ADMIN, que vê todos os grupos. */
  mostrarGrupo?: boolean
}

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function VrMesCard({
  vrMes,
  colaboradores,
  entidades,
  onAtualizado,
  mostrarGrupo = false,
}: VrMesCardProps) {
  const [baixando, setBaixando] = useState<FormatoExportacaoVr | null>(null)

  async function handleBaixarTudo(formato: FormatoExportacaoVr) {
    setBaixando(formato)
    try {
      await vrService.baixar(vrMes, formato)
    } finally {
      setBaixando(null)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">
          {MESES_LABEL[vrMes.mes - 1]} / {vrMes.ano}
          {mostrarGrupo && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">{vrMes.grupo}</span>
          )}
        </h3>
        <div className="flex items-center gap-1">
          {vrMes.fechado ? (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              Fechado
            </Badge>
          ) : (
            <>
              <Badge variant="outline" className="gap-1">
                Aberto
              </Badge>
              <EditarVrMesDialog vrMes={vrMes} onEditado={onAtualizado} />
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>Valor diário</span>
        <span className="text-right text-foreground">{formatarMoeda(vrMes.valorDiario)}</span>
        <span>Aprendiz/Estagiário</span>
        <span className="text-right text-foreground">
          {formatarMoeda(vrMes.valorDiarioAprendiz)}
        </span>
        <span>Dias elegíveis</span>
        <span className="text-right text-foreground">
          {vrMes.diasElegiveis}
          {vrMes.diasElegiveis === 0 && !vrMes.fechado && (
            <span className="ml-1 text-xs text-amber-500">(pendente)</span>
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <FecharPorEntidadeDialog vrMes={vrMes} entidades={entidades} onFechado={onAtualizado} />
        <LancamentosVrDialog vrMes={vrMes} colaboradores={colaboradores} entidades={entidades} />

        {vrMes.fechado && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={baixando !== null}
                className="gap-1.5"
                title="Baixar o relatório com todas as entidades juntas"
              >
                <Download className="h-4 w-4" />
                {baixando ? 'Baixando...' : 'Baixar tudo'}
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => handleBaixarTudo('pdf')}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBaixarTudo('csv')}>
                CSV (operadora)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleBaixarTudo('xlsx')}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
