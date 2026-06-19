import { Info, Plus } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { Idioma } from '../types'

interface IdiomasProps {
  data: Idioma[]
}

export function Idiomas({ data }: IdiomasProps) {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Idiomas</CardTitle>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Plus className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="grid gap-6 pt-4">
        <div className="flex flex-col gap-4">
          {data.map((item) => (
            <div key={item.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">{item.idioma}</span>
                <span className="font-medium text-muted-foreground">
                  {item.nivel}
                </span>
              </div>
              <Progress value={item.progresso} className="h-2" />
            </div>
          ))}
        </div>

        <Alert className="border-none bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-sm">
            Proficiência avaliada pelo teste interno IntegraRH Lang em 15/05/2024.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
