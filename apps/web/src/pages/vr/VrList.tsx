import { AppLayout } from '@/features/app/components'
import { NovoVrMesDialog, TodosLancamentosDialog, VrMesList } from '@/features/vr/components'
import { useVr } from '@/features/vr/hooks'

/**
 * Página de Vale-Refeição (VR). Lista os meses cadastrados, permite
 * cadastrar um novo mês, lançar descontos/extras por colaborador (com
 * filtro de entidade), fechar e baixar os arquivos POR ENTIDADE (cada
 * entidade — ACeAm, RADOAM, NT Store... — fecha de forma independente).
 */
export function VrList() {
  const { meses, colaboradores, entidades, criar, recarregar } = useVr()
  const mesAberto = meses.find((m) => !m.fechado)

  return (
    <AppLayout
      title="Vale-Refeição"
      description="Home / Gestão de Pessoas / Vale-Refeição"
      actions={
        <div className="flex items-center gap-2">
          <TodosLancamentosDialog />
          <NovoVrMesDialog onCriar={criar} mesAbertoExistente={mesAberto} />
        </div>
      }
    >
      <VrMesList
        meses={meses}
        colaboradores={colaboradores}
        entidades={entidades}
        onAtualizado={recarregar}
      />
    </AppLayout>
  )
}
