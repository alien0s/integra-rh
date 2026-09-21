import Autoplay from 'embla-carousel-autoplay'
import { CalendarDays, MapPin } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import type { EventoItem } from '../types'

/** Setas só aparecem no hover, sobrepostas ao conteúdo (não empurram layout). */
const BOTAO_CLASSE =
  'z-10 opacity-0 transition-opacity duration-200 group-hover:opacity-100'

interface EventosCarouselProps {
  eventos: EventoItem[]
}

/** Carrossel de eventos da empresa (foto + legenda). */
export function EventosCarousel({ eventos }: EventosCarouselProps) {
  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0">
        {eventos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento no momento.</p>
        ) : (
          <Carousel
            className="group"
            opts={{ loop: true }}
            plugins={[Autoplay({ delay: 7000, stopOnMouseEnter: true, stopOnInteraction: false })]}
          >
            <CarouselContent>
              {eventos.map((evento) => (
                <CarouselItem key={evento.id}>
                  <div className="overflow-hidden rounded-lg border">
                    <img
                      src={evento.imagemUrl}
                      alt={evento.titulo}
                      className="h-44 w-full object-cover"
                    />
                    <div className="space-y-1 p-4">
                      <p className="font-semibold leading-snug">{evento.titulo}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {evento.data}
                        </span>
                        {evento.local && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {evento.local}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{evento.descricao}</p>
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className={`left-2 ${BOTAO_CLASSE}`} />
            <CarouselNext className={`right-2 ${BOTAO_CLASSE}`} />
          </Carousel>
        )}
      </CardContent>
    </Card>
  )
}
