import { Award, CheckCircle2, Cloud, Plus, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Certificacao } from '../types'

interface CertificacoesProps {
  data: Certificacao[]
}

export function Certificacoes({ data }: CertificacoesProps) {
  const renderIcon = (icone: string) => {
    switch (icone) {
      case 'shield':
        return <ShieldCheck className="h-6 w-6" />
      case 'cloud':
        return <Cloud className="h-6 w-6" />
      default:
        return <Award className="h-6 w-6" />
    }
  }

  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
            <Award className="h-5 w-5" />
          </div>
          <CardTitle className="text-lg">Certificações</CardTitle>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4">
        {data.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center rounded-full border p-2">
                {renderIcon(item.icone)}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold">{item.nome}</span>
                <span className="mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">
                  {item.emissor} • {item.validade}
                </span>
              </div>
            </div>
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
