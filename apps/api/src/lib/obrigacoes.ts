import { emitirOuRenovarParaUsuario } from "./notificacoes.js";
import { verificarObrigacaoFerias } from "./ferias.js";

/**
 * Notificações de "obrigação recorrente" — um tipo de notificação diferente
 * das notificações de EVENTO já existentes no sistema (alguém solicitou,
 * aprovou, recusou algo — uma linha por acontecimento, que o usuário lê e
 * ela nunca mais volta).
 *
 * Uma obrigação recorrente é algo que o próprio colaborador PRECISA fazer e
 * ainda não fez (ex.: solicitar férias do ciclo vigente). Ela é reavaliada
 * A CADA carga do feed de notificações (`GET /notificacoes`, chamado toda
 * vez que o colaborador abre o sistema) e, enquanto a pendência continuar
 * existindo, o colaborador é cobrado de novo no máximo 1x por dia — mesmo
 * que ele tenha marcado a de ontem como lida. Mas ela NUNCA duplica no feed:
 * existe no máximo UMA linha desse tipo por colaborador, que é RENOVADA
 * (não recriada) a cada nova cobrança — ver `emitirOuRenovarParaUsuario` em
 * notificacoes.ts. A recorrência não depende do campo `lida`: depende só de
 * a última renovação já ter 24h ou mais (ver `JANELA_REPETICAO_HORAS`). Só
 * para de renovar quando `verificar()` disser que a obrigação foi cumprida
 * de verdade (ex.: o colaborador solicitou as férias) — marcar como lida
 * nunca "resolve" uma obrigação, só tira o destaque de não-lida até a
 * próxima renovação.
 *
 * Reaproveita 100% a infraestrutura de notificações já existente (tabela
 * `notificacoes`, `emitirOuRenovarParaUsuario`, SSE, drawer, toasts) — a diferença de
 * comportamento é só de QUANDO/COM QUE FREQUÊNCIA ela é emitida, não de
 * armazenamento. No front, o tipo (prefixo "OBRIGACAO_") já:
 *   - ganha um ícone de cartão diferente ("obrigacao" — ver iconePorTipo em
 *     notificacoes.ts, e o mapa de ícones em NotificacaoItem.tsx);
 *   - aparece com o cartão de destaque mesmo sendo `requerAcao: false` (ver
 *     a condição de montar `cartao` em listNotificacoes, em notificacoes.ts);
 *   - pode navegar pra uma tela ao ser clicada (ver ROTA_POR_TIPO_OBRIGACAO
 *     em NotificacoesDrawer.tsx).
 *
 * COMO ADICIONAR UMA NOVA OBRIGAÇÃO (ex.: "preencha suas informações
 * pessoais"): escreva uma função `verificar(userId)` no módulo de domínio
 * correspondente (ex.: lib/usuarios.ts) que retorna `null` quando cumprida
 * ou `{ acao, detalhe }` quando pendente, e registre-a em `OBRIGACOES`
 * abaixo com um `tipo` novo (sempre prefixado "OBRIGACAO_"). Se a
 * notificação precisar navegar pra alguma tela ao ser clicada, adicione
 * também uma entrada em `ROTA_POR_TIPO_OBRIGACAO` (NotificacoesDrawer.tsx).
 * Nada mais precisa mudar — a emissão, a trava de 1x/dia e o ícone genérico
 * já cobrem qualquer `tipo` prefixado "OBRIGACAO_".
 */

/** Resultado de um `verificar()` quando a obrigação ainda está pendente. */
export interface ObrigacaoResultado {
  /** Texto curto (aparece ao lado de "Sistema", como as demais notificações). */
  acao: string;
  /** Texto mais longo/explicativo (aparece no cartão de destaque). */
  detalhe: string;
}

/** Uma obrigação recorrente registrada. */
export interface ObrigacaoRecorrente {
  /** Sempre prefixado "OBRIGACAO_" — usado por iconePorTipo e pelo front. */
  tipo: string;
  /** Retorna null quando cumprida; `{ acao, detalhe }` quando pendente. */
  verificar: (userId: string) => Promise<ObrigacaoResultado | null>;
}

/** Registro de obrigações recorrentes — adicione novas aqui (ver JSDoc acima). */
const OBRIGACOES: ObrigacaoRecorrente[] = [
  { tipo: "OBRIGACAO_FERIAS_SOLICITAR", verificar: verificarObrigacaoFerias },
];

/**
 * Não reemite a mesma obrigação pro mesmo colaborador antes desse tempo —
 * evita duplicar a cada refresh/aba/poll dentro do mesmo dia, mas garante
 * que uma nova apareça na próxima vez que ele abrir o sistema no dia
 * seguinte (mesmo que a de hoje já tenha sido marcada como lida).
 */
const JANELA_REPETICAO_HORAS = 24;

/**
 * Avalia todas as obrigações recorrentes de um colaborador e emite as que
 * estiverem pendentes (respeitando a janela de repetição). Chamado a cada
 * carga do feed de notificações (`GET /notificacoes`) — idempotente e
 * barato, na mesma linha do que já era feito pelo antigo `avaliarLembreteCiclo`.
 */
export async function avaliarObrigacoesRecorrentes(userId: string): Promise<void> {
  for (const obrigacao of OBRIGACOES) {
    const resultado = await obrigacao.verificar(userId);
    if (!resultado) continue; // obrigação cumprida — nada a fazer

    await emitirOuRenovarParaUsuario(
      userId,
      {
        atorId: null,
        tipo: obrigacao.tipo,
        acao: resultado.acao,
        detalhe: resultado.detalhe,
        requerAcao: false,
      },
      JANELA_REPETICAO_HORAS,
    );
  }
}
