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
 * Dashboard inicial (rota /home — "Dashboard" na sidebar). Comunicados,
 * férias e aniversariantes vêm da API real (ver
 * features/home/services/homeService.ts).
 */

export function HomePage() {
  const { data, isLoading, recarregar } = useHomeDashboard()
  const { usuario } = useAuth()
  const podeCriarComunicado = usuario?.papelCodigo !== 'COLABORADOR'
  const ehRH = usuario?.papelCodigo === 'RH' || usuario?.papelCodigo === 'ADMIN'

  // Mesmos 3 botões em dois lugares: no cabeçalho (desktop, sm+, largura de
  // conteúdo normal) e numa linha própria no topo do conteúdo (só mobile,
  // <sm) — no cabeçalho não cabem os 3 junto com menu/busca/sino numa tela de
  // celular. Na linha mobile, `flex-1` faz os 3 crescerem e preencherem a
  // largura toda, em vez de ficarem compactos coladinhos à esquerda.
  function botoesAnuncios(largos?: boolean) {
    const className = largos ? 'flex-1' : undefined
    return (
      <>
        {ehRH && <AnunciosAtivosDialog onRemovido={recarregar} className={className} />}
        {ehRH && <AnunciosAgendadosDialog onRemovido={recarregar} className={className} />}
        {podeCriarComunicado && <NovoComunicadoDialog onCriado={recarregar} className={className} />}
      </>
    )
  }

  return (
    <AppLayout
      title="Anúncios"
      description="Home / Anúncios"
      actions={<div className="hidden items-center gap-2 sm:flex">{botoesAnuncios()}</div>}
    >
      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 sm:hidden">{botoesAnuncios(true)}</div>

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
