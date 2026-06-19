import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  UsersRound,
} from "lucide-react"

import { AppLayout } from "@/features/app/components"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const metrics = [
  {
    label: "Funcionários ativos",
    value: "128",
    description: "Cadastro inicial do RH",
    icon: UsersRound,
  },
  {
    label: "Folhas em aberto",
    value: "3",
    description: "Competências aguardando conferência",
    icon: ClipboardList,
  },
  {
    label: "Eventos hoje",
    value: "9",
    description: "Pendências operacionais",
    icon: CalendarClock,
  },
]

/**
 * Home inicial do ERP após o login local.
 */
export function HomePage() {
  return (
    <AppLayout
      title="Home do ERP"
      description="Visão geral inicial do IntegraRH"
    >
      <section className="flex w-full flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <Badge variant="outline">Ambiente sem autenticação real</Badge>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight">
                Resumo operacional
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Área inicial para validar o fluxo de login enquanto o banco e
                as tabelas de usuários ainda não existem.
              </p>
            </div>
          </div>
          <Button className="md:self-end">
            <BarChart3 className="h-4 w-4" />
            Ver indicadores
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => {
            const Icon = metric.icon

            return (
              <Card key={metric.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardDescription>{metric.label}</CardDescription>
                    <CardTitle className="mt-2 text-2xl">
                      {metric.value}
                    </CardTitle>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {metric.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </AppLayout>
  )
}
