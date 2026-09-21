import { useEffect, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  SquareUser,
  Barcode,
  Briefcase,
  Building2,
  Cake,
  CalendarCheck,
  CalendarX,
  CheckCircle2,
  Clock,
  Fingerprint,
  Hash,
  Heart,
  IdCard,
  Landmark,
  Mail,
  MapPin,
  Phone,
  UserRound,
  VenusAndMars,
  Wallet
} from 'lucide-react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { mascararCpf, mascararTelefone } from '@/lib/masks'
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

/** Rótulo de exibição do tipo de vínculo (mesmos códigos da coluna users.tipo_funcionario). */
const TIPO_FUNCIONARIO_LABEL: Record<string, string> = {
  COLABORADOR: 'Colaborador',
  'APRENDIZ/ESTAGIÁRIO': 'Aprendiz/Estagiário',
}

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

  /**
   * Copia via Clipboard API quando disponível (contexto seguro: HTTPS ou
   * localhost). Em HTTP puro por IP (ex.: acesso pela VM), a API não existe
   * ou falha — usa o fallback do textarea + execCommand nesse caso.
   */
  async function copiarParaAreaDeTransferencia(value: string): Promise<boolean> {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value)
        return true
      } catch {
        // Cai no fallback abaixo.
      }
    }

    try {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const copiado = document.execCommand('copy')
      document.body.removeChild(textarea)
      return copiado
    } catch {
      return false
    }
  }

  async function copiar(label: string, value: string) {
    const sucesso = await copiarParaAreaDeTransferencia(value)
    if (!sucesso) return
    setCopiado(label)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopiado(null), 2000)
  }

  const items: InfoItem[] = [
    { icon: Mail, label: 'E-mail corporativo', value: usuario.email, copiavel: true },
    {
      icon: Phone,
      label: 'Telefone',
      value: usuario.telefone ? mascararTelefone(usuario.telefone) : undefined,
      copiavel: true,
    },
    {
      icon: Fingerprint,
      label: 'CPF',
      value: usuario.cpf ? mascararCpf(usuario.cpf) : undefined,
      copiavel: true,
    },
    { icon: Cake, label: 'Nascimento', value: usuario.dataNascimento ?? undefined },
    {
      icon: VenusAndMars,
      label: 'Sexo',
      value:
        usuario.sexo === 1
          ? 'Masculino'
          : usuario.sexo === 0
            ? 'Feminino'
            : undefined,
    },
    { icon: Heart, label: 'Estado civil', value: usuario.estadoCivil ?? undefined },
    {
      icon: MapPin,
      label: 'Naturalidade',
      value: usuario.cidade
        ? `${usuario.cidade}${usuario.estado ? ` - ${usuario.estado}` : ''}`
        : undefined,
    },
    {
      icon: IdCard,
      label: 'PIS',
      value: usuario.pis ?? undefined,
      copiavel: true,
    },
    {
      icon: Landmark,
      label: 'Conta bancária',
      value: usuario.numeroConta
        ? `${usuario.numeroBanco ? `${usuario.numeroBanco} • ` : ''}${usuario.numeroConta}${usuario.digitoConta ? `-${usuario.digitoConta}` : ''}`
        : undefined,
      copiavel: true,
    },
    { icon: Briefcase, label: 'Função', value: usuario.funcao },
    { icon: Building2, label: 'Setor', value: usuario.setor },
    {
      icon: SquareUser,
      label: 'Tipo de vínculo',
      value: usuario.tipoFuncionario
        ? (TIPO_FUNCIONARIO_LABEL[usuario.tipoFuncionario] ?? usuario.tipoFuncionario)
        : undefined,
    },
    {
      icon: Wallet,
      label: 'Salário',
      value: usuario.salario != null ? moedaBRL.format(usuario.salario) : undefined,
    },
    { icon: CalendarCheck, label: 'Admissão', value: usuario.dataAdmissao },
    { icon: CalendarX, label: 'Demissão', value: usuario.dataDemissao },
    { icon: UserRound, label: 'Gestor', value: usuario.gestor },
    { icon: Clock, label: 'Último acesso', value: usuario.ultimoAcesso },
    {
      icon: Hash,
      label: 'Código APS',
      value: usuario.codigoAps ?? undefined,
      copiavel: true,
    },
    {
      icon: Barcode,
      label: 'Código APS + Entidade',
      value: usuario.codigoApsEntidade ?? undefined,
      copiavel: true,
    },
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
