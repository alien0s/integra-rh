import { useState } from 'react'
import { Loader2, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { exportarMapaFeriasPdf, feriasService } from '@/features/ferias/services'

/**
 * Botão (só ícone) que gera e baixa o PDF "Mapa de Férias" — tabela com
 * nome e período de quem entra de férias no mês mais próximo com alguém
 * agendado (ver exportarMapaFeriasPdf).
 */
export function ImprimirMapaFeriasButton() {
  const [gerando, setGerando] = useState(false)

  async function handleClick() {
    setGerando(true)
    try {
      const { vaoEntrar } = await feriasService.getGeral()
      if (vaoEntrar.length === 0) {
        toast({
          title: 'Nada pra imprimir',
          description: 'Não há férias aprovadas agendadas no momento.',
          variant: 'destructive',
        })
        return
      }
      exportarMapaFeriasPdf(vaoEntrar)
    } catch (error) {
      toast({
        title: 'Não foi possível gerar o mapa de férias',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setGerando(false)
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={handleClick}
          disabled={gerando}
          aria-label="Imprimir mapa de férias"
        >
          {gerando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Printer className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>Imprimir mapa de férias</TooltipContent>
    </Tooltip>
  )
}
