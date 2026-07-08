import { Monitor, Moon, Sun } from 'lucide-react'

import { useTheme, type Theme } from '@/components/theme-provider'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

const opcoes: { valor: Theme; label: string; icon: typeof Sun }[] = [
  { valor: 'system', label: 'Sistema', icon: Monitor },
  { valor: 'light', label: 'Claro', icon: Sun },
  { valor: 'dark', label: 'Escuro', icon: Moon },
]

/**
 * Seção de aparência — controla o tema (claro/escuro/sistema) via ThemeProvider.
 */
export function AparenciaForm() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-medium">Aparência</h3>
        <p className="text-sm text-muted-foreground">
          Personalize o tema da interface. A preferência é salva no dispositivo.
        </p>
      </div>
      <Separator />

      <div className="flex flex-wrap gap-3">
        {opcoes.map(({ valor, label, icon: Icon }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setTheme(valor)}
            className={cn(
              'flex w-28 flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition-colors',
              theme === valor
                ? 'border-primary bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
