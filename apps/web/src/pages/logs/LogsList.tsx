import { AppLayout } from '@/features/app/components/AppLayout'
import { LogsErrosSection } from '@/features/logs/components'

/**
 * Página de Logs (erros inesperados do backend) — diagnóstico interno,
 * só ADMIN (ver /logs em App.tsx).
 */
export function LogsList() {
  return (
    <AppLayout
      title="Logs"
      description="Home / Logs"
      breadcrumbs={[{ label: 'Logs' }]}
      fillHeight
    >
      <LogsErrosSection />
    </AppLayout>
  )
}
