import { AppLayout } from '@/features/app/components'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/context'
import {
  AniversariantesCard,
  AppsLinksCard,
  ComunicadosCarousel,
  FeriasStatusCard,
} from '@/features/home/components'
import { useHomeDashboard } from '@/features/home/hooks'
import { NovoComunicadoDialog, ComunicadosPendentesCard, AnunciosAtivosDialog, AnunciosAgendadosDialog } from '@/features/comunicacao/components'

/**
 * Dashboard inicial (rota /home — "Dashboard" na sidebar). Comunicados vêm
 * da API real; férias e aniversariantes ainda são estáticos (ver
 * features/home/services/homeService.ts).
 */

export function HomePage() {
  const { data, isLoading, recarregar } = useHomeDashboard()
  const { usuario } = useAuth()
  const podeCriarComunicado = usuario?.papelCodigo !== 'COLABORADOR'
  const ehRH = usuario?.papelCodigo === 'RH' || usuario?.papelCodigo === 'ADMIN'

  return (
    <AppLayout
      title="Anúncios"
      description="Home / Anúncios"
      actions={
        <div className="flex items-center gap-2">
          {ehRH && <AnunciosAtivosDialog onRemovido={recarregar} />}
          {ehRH && <AnunciosAgendadosDialog onRemovido={recarregar} />}
          {podeCriarComunicado && <NovoComunicadoDialog onCriado={recarregar} />}
        </div>
      }
    >
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col gap-6">
          {ehRH && <ComunicadosPendentesCard />}

          <ComunicadosCarousel comunicados={data.comunicados} />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <AppsLinksCard />
            <FeriasStatusCard {...data.ferias} />
            <AniversariantesCard aniversariantes={data.aniversariantes} />
          </div>
          
        </div>
      )}
    </AppLayout>
  )
}
