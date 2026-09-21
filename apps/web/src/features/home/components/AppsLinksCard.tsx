import { Car, Church, HandCoins, Landmark, LayoutGrid, type LucideIcon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface AppLink {
  nome: string
  descricao: string
  url: string
  icon: LucideIcon
  iconClasse: string
}

const APPS: AppLink[] = [
  {
    nome: 'Presença no Culto',
    descricao: 'Registro de frequência',
    url: 'https://apps.powerapps.com/play/e/9f4ae611-d59c-ec5f-9fcd-658c9cc3fce6/a/9ce75f0d-e9da-43ec-91a8-0f92364e9db4?tenantId=01ee7ae0-42ba-41a5-bb7b-8d4af8db7f07&hint=9ce25b19-136d-4776-b54a-5103c60c0d88&sourcetime=1789478234115',
    icon: Church,
    iconClasse: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400',
  },
  {
    nome: 'Subvenção',
    descricao: 'Solicitações e acompanhamento',
    url: 'https://apps.powerapps.com/play/e/9f4ae611-d59c-ec5f-9fcd-658c9cc3fce6/a/c975dc19-02fb-4116-b70a-07f349306516?tenantId=01ee7ae0-42ba-41a5-bb7b-8d4af8db7f07&hint=c10f5dc7-fd25-4932-ac23-4c6ea995c8dc&sourcetime=1789478249661',
    icon: HandCoins,
    iconClasse: 'bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400',
  },
  {
    nome: 'Tesouraria de Igrejas e Auditoria',
    descricao: 'Prestação de contas',
    url: 'https://apps.powerapps.com/play/e/9f4ae611-d59c-ec5f-9fcd-658c9cc3fce6/a/68ba4f44-c7e8-4570-afd5-25cb00a6baa9?tenantId=01ee7ae0-42ba-41a5-bb7b-8d4af8db7f07&sourcetime=1789478282753',
    icon: Landmark,
    iconClasse: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
  },
  {
    nome: 'Veículos',
    descricao: 'Reserva e controle de frota',
    url: 'https://apps.powerapps.com/play/e/9f4ae611-d59c-ec5f-9fcd-658c9cc3fce6/a/4234c8ff-7087-49e1-ae89-f796f29abe58?tenantId=01ee7ae0-42ba-41a5-bb7b-8d4af8db7f07&hint=75599a0e-d7fc-4af3-b91c-8379f2e8fe7d&sourcetime=1789478312581',
    icon: Car,
    iconClasse: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400',
  },
]

/** Atalhos pros sistemas Power Apps da organização (Central de Aplicativos). */
export function AppsLinksCard() {
  return (
    <Card className="shadow-none">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <LayoutGrid className="h-5 w-5" />
        </div>
        <CardTitle className="text-lg">Central de Aplicativos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
        {APPS.map((app) => (
          <a
            key={app.nome}
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
          >
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${app.iconClasse}`}>
              <app.icon className="h-5 w-5" />
            </div>
            <div className="grid min-w-0 gap-0.5">
              <span className="truncate text-sm font-medium leading-none">{app.nome}</span>
              <span className="truncate text-xs text-muted-foreground">{app.descricao}</span>
            </div>
          </a>
        ))}
      </CardContent>
    </Card>
  )
}
