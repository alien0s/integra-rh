import type { ColaboradorOpcao, EntidadeOpcao, VrMes } from '@/features/vr/types'
import { VrMesCard } from './VrMesCard'

interface VrMesListProps {
  meses: VrMes[]
  colaboradores: ColaboradorOpcao[]
  entidades: EntidadeOpcao[]
  onAtualizado: () => Promise<void>
  mostrarGrupo?: boolean
}

export function VrMesList({
  meses,
  colaboradores,
  entidades,
  onAtualizado,
  mostrarGrupo = false,
}: VrMesListProps) {
  if (meses.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum mês de VR cadastrado ainda. Clique em "Novo mês" para começar.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {meses.map((vrMes) => (
        <VrMesCard
          key={vrMes.id}
          vrMes={vrMes}
          colaboradores={colaboradores}
          entidades={entidades}
          onAtualizado={onAtualizado}
          mostrarGrupo={mostrarGrupo}
        />
      ))}
    </div>
  )
}
