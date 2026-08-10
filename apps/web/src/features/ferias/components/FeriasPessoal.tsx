import {
  addYears,
  format,
  isAfter,
  parse,
  subDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { useUsuarioLogado } from '@/features/auth/hooks'
import { FeriasResumoCards } from './FeriasResumoCards'
import { HistoricoSolicitacoes } from './HistoricoSolicitacoes'
import { NovaSolicitacaoForm } from './NovaSolicitacaoForm'

import type { FeriasResumo, MinhaSolicitacao } from '@/features/ferias/types'

// Dados mock — virão da API (resumo + histórico do usuário logado) quando o
// autosserviço estiver ligado à autenticação. Do resumo, hoje só o
// "período aquisitivo" é real (calculado a partir de data_admissao); os dias
// disponíveis/agendados seguem mock por enquanto.
const resumoMock: FeriasResumo = {
  diasDisponiveis: 22,
  diasAgendados: 8,
  periodoAquisitivo: '—',
}

const historicoMock: MinhaSolicitacao[] = [
  {
    id: '1',
    periodo: '15 Dez 2023 - 29 Dez 2023',
    detalhe: '15 dias corridos',
    tipo: 'Férias Regulares',
    status: 'APROVADO',
  },
  {
    id: '2',
    periodo: '10 Jul 2024 - 19 Jul 2024',
    detalhe: '10 dias (Abono incluso)',
    tipo: 'Férias + Abono',
    status: 'PENDENTE',
  },
  {
    id: '3',
    periodo: '02 Fev 2023 - 12 Fev 2023',
    detalhe: '10 dias corridos',
    tipo: 'Férias Regulares',
    status: 'RECUSADO',
  },
]

/** Formata uma data como "15 Jun 2024" (mês abreviado, 1ª letra maiúscula). */
function formatarDataResumo(data: Date): string {
  // date-fns em pt-BR devolve o mês abreviado em minúsculo ("jun"); deixamos
  // a inicial maiúscula para casar com o estilo do card ("15 Jun 2024").
  const texto = format(data, 'dd MMM yyyy', { locale: ptBR })
  return texto.replace(/ ([a-z])/, (_, letra: string) => ` ${letra.toUpperCase()}`)
}

/**
 * Calcula o período aquisitivo VIGENTE a partir da data de admissão.
 *
 * O período aquisitivo é o ciclo de 12 meses que começa no aniversário de
 * admissão e vai até o dia anterior ao aniversário seguinte. Ex.: admitido em
 * 07/07/2022 → ciclos 07/07→06/07 a cada ano; escolhemos o que contém "hoje".
 *
 * Recebe a data no formato "DD/MM/AAAA" (como vem da API) e devolve o texto
 * "DD Mmm AAAA - DD Mmm AAAA", ou null se a data for inválida/ausente.
 */
function calcularPeriodoAquisitivo(dataAdmissaoBR?: string | null): string | null {
  if (!dataAdmissaoBR) return null

  // Converte "DD/MM/AAAA" em Date; rejeita datas inválidas.
  const admissao = parse(dataAdmissaoBR, 'dd/MM/yyyy', new Date())
  if (Number.isNaN(admissao.getTime())) return null

  const hoje = new Date()

  // Aniversário de admissão no ano corrente (mesmo dia/mês, ano de hoje).
  const aniversarioEsteAno = new Date(
    hoje.getFullYear(),
    admissao.getMonth(),
    admissao.getDate(),
  )

  // Se o aniversário deste ano ainda não chegou, o ciclo vigente começou no
  // aniversário do ano passado; senão, começou no aniversário deste ano.
  const inicio = isAfter(aniversarioEsteAno, hoje)
    ? addYears(aniversarioEsteAno, -1)
    : aniversarioEsteAno

  // O ciclo termina no dia anterior ao próximo aniversário (12 meses - 1 dia).
  const fim = subDays(addYears(inicio, 1), 1)

  return `${formatarDataResumo(inicio)} - ${formatarDataResumo(fim)}`
}

/**
 * Aba "Pessoal" — autosserviço do colaborador: resumo do saldo, nova
 * solicitação e histórico das próprias solicitações.
 */
export function FeriasPessoal() {
  // Perfil do usuário logado (traz data_admissao já formatada "DD/MM/AAAA").
  const { usuario } = useUsuarioLogado()

  // Monta o resumo: mantém os dias mock e preenche o período aquisitivo com o
  // ciclo vigente calculado a partir da data de admissão (ou "—" se não houver).
  const resumo: FeriasResumo = {
    ...resumoMock,
    periodoAquisitivo:
      calcularPeriodoAquisitivo(usuario?.dataAdmissao) ??
      resumoMock.periodoAquisitivo,
  }

  return (
    <div className="flex flex-col gap-4">
      <FeriasResumoCards resumo={resumo} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <NovaSolicitacaoForm />
        <HistoricoSolicitacoes solicitacoes={historicoMock} />
      </div>
    </div>
  )
}
