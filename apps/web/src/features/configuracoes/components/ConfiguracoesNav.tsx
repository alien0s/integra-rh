import type { LucideIcon } from 'lucide-react'
import { Bell, BookOpen, Palette } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/context'

import type { ConfiguracoesSection } from '@/features/configuracoes/types'

interface ConfiguracoesNavProps {
  active: ConfiguracoesSection
  onSelect: (section: ConfiguracoesSection) => void
}

/**
 * Navegação lateral das configurações. Destaca a seção ativa.
 */
export function ConfiguracoesNav({ active, onSelect }: ConfiguracoesNavProps) {
  const { usuario } = useAuth()

  const items: { id: ConfiguracoesSection; label: string; icon: LucideIcon }[] = [
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    // Documentação da API exige ADMIN no backend (ver docs/api.md) — some do
    // menu pra quem não é, mesma convenção do item "Logs" no AppSidebar.
    ...(usuario?.papelCodigo === 'ADMIN'
      ? [{ id: 'documentacao-api' as const, label: 'Documentação da API', icon: BookOpen }]
      : []),
  ]

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
