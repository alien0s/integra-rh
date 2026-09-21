import { useEffect, useState } from 'react'
import Autoplay from 'embla-carousel-autoplay'
import { FileText } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { comunicacaoService } from '@/features/comunicacao/services'
import type { ComunicadoItem } from '../types'

/** Setas só aparecem no hover, sobrepostas ao conteúdo (não empurram layout). */
const BOTAO_CLASSE =
  'z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100'

interface ComunicadosCarouselProps {
  comunicados: ComunicadoItem[]
}

/** Busca e mantém a object URL do anexo de um comunicado, liberando ao trocar/desmontar. */
function useAnexoUrl(id: string, anexoTipo: ComunicadoItem['anexoTipo']) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!anexoTipo) return
    let objectUrl: string | null = null
    let cancelado = false

    comunicacaoService.buscarAnexoUrl(Number(id)).then((resultado) => {
      if (cancelado) return
      objectUrl = resultado
      setUrl(resultado)
    })

    return () => {
      cancelado = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, anexoTipo])

  return url
}

function ComunicadoSlide({ comunicado }: { comunicado: ComunicadoItem }) {
  const anexoUrl = useAnexoUrl(comunicado.id, comunicado.anexoTipo)

  if (comunicado.anexoTipo === 'IMAGEM' && anexoUrl) {
    return (
      <div className="relative flex h-[420px] items-end overflow-hidden rounded-xl bg-black sm:h-[520px]">
        {/* Fundo: a própria imagem, borrada e ampliada, preenche o espaço sem cortar a de cima */}
        <div
          aria-hidden
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-2xl"
          style={{ backgroundImage: `url(${anexoUrl})` }}
        />
        {/* Imagem completa, sempre inteira (nunca cortada) */}
        <img
          src={anexoUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-contain"
        />
        <div className="relative w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pt-16 sm:p-8 sm:pt-24">
          <div className="flex items-center justify-between gap-2 text-white/70">
            <span className="text-sm">{comunicado.data}</span>
          </div>
          <p className="mt-1 text-2xl font-semibold leading-tight text-white sm:text-3xl">
            {comunicado.titulo}
          </p>
          <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">{comunicado.resumo}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[420px] flex-col justify-center rounded-xl border bg-muted/20 p-8 text-center sm:h-[520px]">
      <span className="text-sm text-muted-foreground">{comunicado.data}</span>
      <p className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">{comunicado.titulo}</p>
      <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
        {comunicado.resumo}
      </p>
      {comunicado.anexoTipo === 'PDF' && (
        <a
          href={anexoUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-4 flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <FileText className="h-4 w-4" />
          Ver anexo (PDF)
        </a>
      )}
    </div>
  )
}

/** Carrossel de comunicados e avisos — destaque grande no topo da Home. */
export function ComunicadosCarousel({ comunicados }: ComunicadosCarouselProps) {
  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0">
        {comunicados.length === 0 ? (
          <div className="flex h-[420px] items-center justify-center rounded-xl border sm:h-[520px]">
            <p className="text-sm text-muted-foreground">Nenhum comunicado no momento.</p>
          </div>
        ) : (
          <Carousel
            className="group"
            opts={{ loop: true }}
            plugins={[Autoplay({ delay: 7000, stopOnMouseEnter: true, stopOnInteraction: false })]}
          >
            <CarouselContent>
              {comunicados.map((comunicado) => (
                <CarouselItem key={comunicado.id}>
                  <ComunicadoSlide comunicado={comunicado} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className={`left-4 ${BOTAO_CLASSE}`} />
            <CarouselNext className={`right-4 ${BOTAO_CLASSE}`} />
          </Carousel>
        )}
      </CardContent>
    </Card>
  )
}
