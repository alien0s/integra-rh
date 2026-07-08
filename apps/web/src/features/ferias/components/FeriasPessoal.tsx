import { FeriasResumoCards } from './FeriasResumoCards'
import { HistoricoSolicitacoes } from './HistoricoSolicitacoes'
import { NovaSolicitacaoForm } from './NovaSolicitacaoForm'

import type { FeriasResumo, MinhaSolicitacao } from '@/features/ferias/types'

// Dados mock — virão da API (resumo + histórico do usuário logado) quando o
// autosserviço estiver ligado à autenticação.
const resumoMock: FeriasResumo = {
  diasDisponiveis: 22,
  diasAgendados: 8,
  periodoAquisitivo: '15 Jun 2024 - 14 Jun 2025',
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

/**
 * Aba "Pessoal" — autosserviço do colaborador: resumo do saldo, nova
 * solicitação e histórico das próprias solicitações.
 */
export function FeriasPessoal() {
  return (
    <div className="flex flex-col gap-4">
      <FeriasResumoCards resumo={resumoMock} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <NovaSolicitacaoForm />
        <HistoricoSolicitacoes solicitacoes={historicoMock} />
      </div>
    </div>
  )
}
