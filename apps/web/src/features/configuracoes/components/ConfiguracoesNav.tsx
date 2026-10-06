import type { LucideIcon } from 'lucide-react'
import { Bell, Monitor, Palette, UserCog } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { ConfiguracoesSection } from '@/features/configuracoes/types'

interface ConfiguracoesNavProps {
  active: ConfiguracoesSection
  onSelect: (section: ConfiguracoesSection) => void
}

const items: { id: ConfiguracoesSection; label: string; icon: LucideIcon }[] = [
  { id: 'conta', label: 'Conta', icon: UserCog },
  { id: 'aparencia', label: 'Aparência', icon: Palette },
  { id: 'notificacoes', label: 'Notificações', icon: Bell },
  { id: 'exibicao', label: 'Exibição', icon: Monitor },
]

/**
 * Navegação lateral das configurações. Destaca a seção ativa.
 */
export function ConfiguracoesNav({ active, onSelect }: ConfiguracoesNavProps) {
  return (
    <nav className="flex gap-1 overflow-x-auto lg:w-48 lg:flex-col lg:overflow-visible">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
            active === id
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </nav>
  )
}
