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
  podeFracionarFerias: false,
  podeVenderFerias: false,
}

/**
 * Aba "Pessoal" — autosserviço do colaborador: resumo do saldo, nova
 * solicitação e histórico. Tudo vem da API (hook useFeriasPessoal).
 *
 * A regra de antecedência mínima de 40 dias para solicitar férias (política
 * da empresa; CLT art. 145 exige 30) é validada dentro de NovaSolicitacaoForm
 * — bloqueia a seleção no calendário e o envio, não se aplica à folga.
 */
export function FeriasPessoal() {
  const { resumo, historico, solicitar, cancelar, excluir, aceitarAjuste } = useFeriasPessoal()

  // Regra: só pode ter UMA solicitação de FÉRIAS em andamento por vez
  // (PENDENTE, aguardando o DP, ou com ajuste de data sugerido). Folga não
  // entra nessa regra. Também validado no backend — aqui é só pra desabilitar
  // o formulário e explicar o motivo.
  const temFeriasPendente = historico.some(
    (h) =>
      h.tipoBase === 'FERIAS' &&
      (h.status === 'PENDENTE' ||
        h.status === 'APROVADO_GESTOR' ||
        h.status === 'AJUSTE_SUGERIDO'),
  )

  // Regra: já usou (ao menos em parte) o ciclo aquisitivo vigente — não deixa
  // pedir férias de novo até o próximo ciclo. `diasAgendados` (resumo) já é
  // calculado só com férias APROVADAS dentro do ciclo vigente (ver
  // getResumoFerias). Também validado no backend
  // (SolicitacaoFeriasJaAprovadaError) — aqui é só pra desabilitar o
  // formulário e explicar o motivo antes de tentar enviar.
  //
  // Exceção (podeFracionarFerias): se o único período já aprovado ficou
  // dentro da faixa de fracionamento (10-15 dias), ainda cabe uma 2ª leva —
  // não bloqueia. Aproximação no front (só soma, não sabe quantos pedidos);
  // o backend é quem decide de verdade.
  const usouUmPeriodoFracionavel =
    Boolean(resumo?.podeFracionarFerias) &&
    (resumo?.diasAgendados ?? 0) >= 10 &&
    (resumo?.diasAgendados ?? 0) <= 15
  const temFeriasAprovadaNoCiclo = Boolean(
    resumo && resumo.diasAgendados > 0 && !usouUmPeriodoFracionavel,
  )

  return (
    <div className="flex flex-col gap-4">
      <FeriasResumoCards resumo={resumo ?? resumoVazio} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        {/* A nova solicitação chama a API e recarrega resumo + histórico. */}
        <NovaSolicitacaoForm
          onSolicitar={solicitar}
          temFeriasPendente={temFeriasPendente}
          temFeriasAprovadaNoCiclo={temFeriasAprovadaNoCiclo}
          podeFracionarFerias={resumo?.podeFracionarFerias}
          podeVenderFerias={resumo?.podeVenderFerias}
        />
        <HistoricoSolicitacoes
          solicitacoes={historico}
          onCancelar={cancelar}
          onExcluir={excluir}
          onAceitarAjuste={aceitarAjuste}
        />
      </div>
    </div>
  )
}
