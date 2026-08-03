import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

import { usePreferenciaFerias30 } from '@/lib/preferencias'

/**
 * Preferências de Férias do usuário. Hoje: preencher 30 dias automaticamente
 * ao escolher a data de início das férias.
 */
export function FeriasPreferenciasForm() {
  const [ferias30, setFerias30] = usePreferenciaFerias30()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium">Férias</h3>
        <p className="text-sm text-muted-foreground">
          Preferências de como você solicita suas férias.
        </p>
      </div>
      <Separator />

      <div className="max-w-xl">
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">
              Selecionar 30 dias automaticamente
            </p>
            <p className="text-xs text-muted-foreground">
              Ao escolher a data de início das férias, o período de 30 dias é
              preenchido automaticamente. Você ainda pode ajustar o término.
            </p>
          </div>
          <Switch checked={ferias30} onCheckedChange={setFerias30} />
        </label>
      </div>
    </div>
  )
}
