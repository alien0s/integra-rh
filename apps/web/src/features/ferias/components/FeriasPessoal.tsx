import { useFeriasPessoal } from '@/features/ferias/hooks'
import type { FeriasResumo } from '@/features/ferias/types'
import { FeriasResumoCards } from './FeriasResumoCards'
import { HistoricoSolicitacoes } from './HistoricoSolicitacoes'
import { NovaSolicitacaoForm } from './NovaSolicitacaoForm'

// Resumo de fallback enquanto carrega (evita layout vazio). Os valores reais
// (saldo + período aquisitivo) vêm de GET /ferias/resumo.
const resumoVazio: FeriasResumo = {
  diasDisponiveis: 0,
  diasAgendados: 0,
  periodoAquisitivo: '—',
}

/**
 * Aba "Pessoal" — autosserviço do colaborador: resumo do saldo, nova
 * solicitação e histórico. Tudo vem da API (hook useFeriasPessoal).
 */
export function FeriasPessoal() {
  const { resumo, historico, solicitar } = useFeriasPessoal()

  return (
    <div className="flex flex-col gap-4">
      <FeriasResumoCards resumo={resumo ?? resumoVazio} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* A nova solicitação chama a API e recarrega resumo + histórico. */}
        <NovaSolicitacaoForm onSolicitar={solicitar} />
        <HistoricoSolicitacoes solicitacoes={historico} />
      </div>
    </div>
  )
}
