import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock,
  Fingerprint,
  Mail,
  Phone,
  UserRound,
  Wallet,
} from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Usuario } from '@/features/usuarios/types'

interface UsuarioPerfilInfoProps {
  usuario: Usuario
}

interface InfoItem {
  icon: LucideIcon
  label: string
  value?: string
  /** Permite copiar o valor para a área de transferência ao clicar. */
  copiavel?: boolean
}

const moedaBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

/**
 * Bloco de informações do perfil do funcionário, com ícones.
 * Os campos espelham a tabela `users` do banco. E-mail, telefone e CPF
 * podem ser copiados ao clicar, com notificação no tooltip.
 */
export function UsuarioPerfilInfo({ usuario }: UsuarioPerfilInfoProps) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  async function copiar(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopiado(label)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopiado(null), 2000)
    } catch {
      // Sem permissão de clipboard — ignora silenciosamente.
    }
  }

  const items: InfoItem[] = [
    { icon: Mail, label: 'E-mail corporativo', value: usuario.email, copiavel: true },
    { icon: Phone, label: 'Telefone', value: usuario.telefone, copiavel: true },
    { icon: Fingerprint, label: 'CPF', value: usuario.cpf, copiavel: true },
    { icon: Briefcase, label: 'Função', value: usuario.funcao },
    { icon: Building2, label: 'Departamento', value: usuario.departamento },
    {
      icon: Wallet,
      label: 'Salário',
      value: usuario.salario != null ? moedaBRL.format(usuario.salario) : undefined,
    },
    { icon: CalendarCheck, label: 'Admissão', value: usuario.dataAdmissao },
    { icon: CalendarX, label: 'Demissão', value: usuario.dataDemissao },
    { icon: UserRound, label: 'Gestor', value: usuario.gestor },
    { icon: Clock, label: 'Último acesso', value: usuario.ultimoAcesso },
  ]

  const visibleItems = items.filter((item) => Boolean(item.value))

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      {visibleItems.map(({ icon: Icon, label, value, copiavel }) => (
        <div key={label} className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            {copiavel ? (
              <Tooltip className="block min-w-0 max-w-full">
                <TooltipTrigger>
                  <button
                    type="button"
                    onClick={() => copiar(label, value as string)}
                    className="block w-full truncate text-left text-sm font-medium hover:underline"
                  >
                    {value}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {copiado === label ? (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      Copiado!
                    </span>
                  ) : (
                    'Copiar'
                  )}
                </TooltipContent>
              </Tooltip>
            ) : (
              <p className="truncate text-sm font-medium">{value}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
