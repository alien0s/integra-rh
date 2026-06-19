import { BookOpen, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { CursoWorkshop } from '../types'

interface CursosWorkshopsProps {
  data: CursoWorkshop[]
}

export function CursosWorkshops({ data }: CursosWorkshopsProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            <BookOpen className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Cursos e workshops</CardTitle>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {data.map((item, index) => (
          <div key={item.id} className="flex flex-col">
            <div className="flex items-center justify-between py-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">{item.nome}</span>
                <span className="text-sm text-muted-foreground">
                  {item.escola} • {item.cargaHoraria} • {item.ano}
                </span>
              </div>
              <Button variant="link" className="font-semibold text-brand dark:text-blue-400">
                Ver certificado
              </Button>
            </div>
            {index < data.length - 1 && <Separator className="mt-2" />}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
