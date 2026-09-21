import { getDatabase } from "./database.js";
import { notificarClientes } from "./notificacoesStream.js";

/**
 * Notificações (inbox por destinatário). Um helper único (`emitir*`) grava as
 * linhas quando uma ação relevante acontece; a listagem resolve o ator via
 * JOIN e, nas acionáveis, checa o estado atual do recurso de origem para
 * decidir se ainda mostra os botões (Aprovar/Recusar).
 */

/* ── Emissão ───────────────────────────────────────────────────────────── */

/** Dados de uma notificação a emitir (o destinatário é passado à parte). */
export interface NotificacaoEvento {
  atorId: string | null;
  tipo: string;
  acao: string;
  detalhe?: string | null;
  referenciaTabela?: string | null;
  referenciaId?: string | null;
  requerAcao?: boolean;
}

/** Emite uma notificação para UM destinatário. */
export async function emitirParaUsuario(
  destinatarioId: string,
  evento: NotificacaoEvento,
): Promise<void> {
  const sql = getDatabase();
  await sql`
    INSERT INTO notificacoes (
      destinatario_id, ator_id, tipo, acao, detalhe,
      referencia_tabela, referencia_id, requer_acao
    )
    VALUES (
      ${destinatarioId}, ${evento.atorId}, ${evento.tipo}, ${evento.acao},
      ${evento.detalhe ?? null}, ${evento.referenciaTabela ?? null},
      ${evento.referenciaId ?? null}, ${evento.requerAcao ?? false}
    )
  `;
  // Empurra em tempo real para as conexões SSE abertas do destinatário.
  notificarClientes([destinatarioId]);
}

/**
 * Emite uma notificação "renovável" — usada pelas obrigações recorrentes
 * (obrigacoes.ts), que precisam cobrar o destinatário todo dia sem duplicar
 * a mesma pendência no feed. Ao contrário de `emitirParaUsuario` (sempre
 * insere uma linha nova), esta função mantém NO MÁXIMO uma linha desse
 * `tipo` por destinatário:
 *   - se não existe nenhuma ainda, insere a 1ª;
 *   - se a última já emitida tem `janelaHoras` ou mais, RENOVA essa mesma
 *     linha (acao/detalhe/created_at/lida) em vez de inserir outra — é o
 *     "lembrete de hoje" substituindo o "lembrete de ontem";
 *   - se a última é mais recente que `janelaHoras`, não faz nada (já
 *     cobrado dentro da janela).
 */
export async function emitirOuRenovarParaUsuario(
  destinatarioId: string,
  evento: NotificacaoEvento,
  janelaHoras: number,
): Promise<void> {
  const sql = getDatabase();

  const [ultima] = await sql<{ id: string; expirada: boolean }[]>`
    SELECT id, created_at < NOW() - make_interval(hours => ${janelaHoras}) AS expirada
    FROM notificacoes
    WHERE destinatario_id = ${destinatarioId} AND tipo = ${evento.tipo}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (ultima && !ultima.expirada) return; // já cobrado dentro da janela

  if (ultima) {
    await sql`
      UPDATE notificacoes
      SET acao = ${evento.acao}, detalhe = ${evento.detalhe ?? null},
          created_at = NOW(), lida = FALSE, lida_em = NULL
      WHERE id = ${ultima.id}
    `;
  } else {
    await sql`
      INSERT INTO notificacoes (
        destinatario_id, ator_id, tipo, acao, detalhe,
        referencia_tabela, referencia_id, requer_acao
      )
      VALUES (
        ${destinatarioId}, ${evento.atorId}, ${evento.tipo}, ${evento.acao},
        ${evento.detalhe ?? null}, ${evento.referenciaTabela ?? null},
        ${evento.referenciaId ?? null}, ${evento.requerAcao ?? false}
      )
    `;
  }
  notificarClientes([destinatarioId]);
}

/**
 * Emite (fan-out) para todos os usuários que têm um dos papéis informados.
 * O próprio ator é excluído (não se notifica sozinho). Retorna quantos
 * destinatários receberam.
 */
export async function emitirParaPapeis(
  papeis: string[],
  evento: NotificacaoEvento,
): Promise<number> {
  const sql = getDatabase();
  if (papeis.length === 0) return 0;

  // Insere uma linha por usuário-destino (SELECT → INSERT em um comando só) e
  // devolve os ids atingidos, para o push SSE em tempo real.
  const inseridos = await sql<{ destinatario_id: string }[]>`
    INSERT INTO notificacoes (
      destinatario_id, ator_id, tipo, acao, detalhe,
      referencia_tabela, referencia_id, requer_acao
    )
    SELECT u.id, ${evento.atorId}, ${evento.tipo}, ${evento.acao},
           ${evento.detalhe ?? null}, ${evento.referenciaTabela ?? null},
           ${evento.referenciaId ?? null}, ${evento.requerAcao ?? false}
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE r.codigo = ANY(${papeis})
      AND (${evento.atorId}::uuid IS NULL OR u.id <> ${evento.atorId})
    RETURNING destinatario_id
  `;
  notificarClientes(inseridos.map((r) => r.destinatario_id));
  return inseridos.count;
}

/* ── Listagem / leitura ────────────────────────────────────────────────── */

/** Ícone do cartão no front (mesmos valores do componente). */
type CartaoIcone = "arquivo" | "documento" | "curso" | "obrigacao";

/** Notificação no contrato do front (drawer). */
export interface NotificacaoDTO {
  id: string;
  nome: string; // nome do ator (ou "Sistema")
  acao: string;
  detalhe: string;
  tempo: string; // relativo ("2 min", "1 h", "Ontem"...)
  avatar: string;
  iniciais: string;
  lida: boolean;
  requerAcao?: boolean;
  cartao?: { titulo: string; subtitulo: string; icone?: CartaoIcone };
  /** Recurso de origem — para o card acionar (ex.: aprovar a férias). */
  referenciaTabela?: string | null;
  referenciaId?: string | null;
  tipo: string;
}

interface LinhaNotificacao {
  id: string;
  tipo: string;
  acao: string;
  detalhe: string | null;
  requer_acao: boolean;
  lida: boolean;
  created_at: Date | string;
  ref_status: string | null; // status atual do recurso (se for ferias)
  referencia_tabela: string | null;
  referencia_id: string | null;
  ator_id: string | null;
  ator_nome: string | null;
  ator_avatar: string | null;
}

/** Iniciais (primeiro + último nome). */
function gerarIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Avatar → URL exibível (mesma regra de users). */
function montarAvatarUrl(userId: string | null, valor: string | null): string {
  if (!userId || !valor) return "";
  if (valor.startsWith("http") || valor.startsWith("data:")) return valor;
  return `/usuarios/${userId}/avatar`;
}

/** Tempo relativo curto em pt-BR a partir de created_at. */
function tempoRelativo(valor: Date | string): string {
  const data = valor instanceof Date ? valor : new Date(valor);
  const seg = Math.floor((Date.now() - data.getTime()) / 1000);
  if (seg < 60) return "agora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias === 1) return "Ontem";
  if (dias < 7) return `${dias} d`;
  return data.toLocaleDateString("pt-BR");
}

/** Ícone do cartão conforme o tipo do evento. */
function iconePorTipo(tipo: string): CartaoIcone {
  if (tipo.startsWith("OBRIGACAO_")) return "obrigacao";
  if (tipo.startsWith("FERIAS")) return "documento";
  if (tipo.startsWith("CURSO")) return "curso";
  return "arquivo";
}

/**
 * Uma notificação acionável de férias só mostra os botões enquanto o recurso
 * de origem estiver no status que aquela ETAPA decide:
 *   - FERIAS_SOLICITADA (card do gestor) → acionável enquanto PENDENTE.
 *   - FERIAS_AGUARDA_DP (card do DP)      → acionável enquanto APROVADO_GESTOR.
 * Assim o botão certo aparece pro ator certo e some depois de decidido.
 * Notificações não ligadas a férias mantêm o comportamento anterior.
 */
function acionavelPorEtapa(
  tipo: string,
  referenciaTabela: string | null,
  refStatus: string | null,
): boolean {
  if (referenciaTabela !== "ferias_solicitacoes") return true;
  if (tipo.endsWith("_SOLICITADA")) return refStatus === "PENDENTE";
  if (tipo.endsWith("_AGUARDA_DP")) return refStatus === "APROVADO_GESTOR";
  return refStatus === "PENDENTE";
}

/** Lista as notificações de um destinatário (mais recentes primeiro). */
export async function listNotificacoes(
  destinatarioId: string,
): Promise<NotificacaoDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaNotificacao[]>`
    SELECT n.id, n.tipo, n.acao, n.detalhe, n.requer_acao, n.lida, n.created_at,
           n.referencia_tabela, n.referencia_id,
           fs.status      AS ref_status,
           n.ator_id      AS ator_id,
           a.nome         AS ator_nome,
           a.avatar_url   AS ator_avatar
    FROM notificacoes n
    LEFT JOIN users a ON a.id = n.ator_id
    LEFT JOIN ferias_solicitacoes fs
      ON n.referencia_tabela = 'ferias_solicitacoes' AND fs.id = n.referencia_id
    WHERE n.destinatario_id = ${destinatarioId}
    ORDER BY n.created_at DESC
    LIMIT 50
  `;

  return linhas.map((linha) => {
    // Obrigação recorrente não tem um "autor" — é o próprio sistema
    // cobrando do colaborador, então não faz sentido rotular como "Sistema"
    // (nem mostrar isso na UI, ver NotificacaoItem.tsx/NotificacaoActionToast.tsx).
    const ehObrigacao = linha.tipo.startsWith("OBRIGACAO_");
    const nome = ehObrigacao ? "" : (linha.ator_nome ?? "Sistema");
    // Só ainda "acionável" se o recurso de origem estiver no status da etapa.
    const requerAcao =
      linha.requer_acao &&
      acionavelPorEtapa(linha.tipo, linha.referencia_tabela, linha.ref_status);

    return {
      id: linha.id,
      nome,
      acao: linha.acao,
      detalhe: linha.detalhe ?? "",
      tempo: tempoRelativo(linha.created_at),
      avatar: montarAvatarUrl(linha.ator_id, linha.ator_avatar),
      iniciais: gerarIniciais(nome),
      lida: linha.lida,
      requerAcao,
      // Notificações de obrigação recorrente (ver lib/obrigacoes.ts) também
      // ganham o cartão de destaque mesmo sendo `requerAcao: false` — é
      // informativa (sem botões Aprovar/Recusar), mas precisa se destacar
      // visualmente das notificações comuns.
      cartao:
        requerAcao || linha.tipo.startsWith("OBRIGACAO_")
          ? {
              titulo: linha.detalhe ?? linha.acao,
              subtitulo: nome
                ? `${nome} • ${tempoRelativo(linha.created_at)}`
                : tempoRelativo(linha.created_at),
              icone: iconePorTipo(linha.tipo),
            }
          : undefined,
      referenciaTabela: linha.referencia_tabela,
      referenciaId: linha.referencia_id,
      tipo: linha.tipo,
    };
  });
}

/** Conta as não-lidas de um destinatário (badge do sino). */
export async function contarNaoLidas(destinatarioId: string): Promise<number> {
  const sql = getDatabase();
  const [row] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int AS total
    FROM notificacoes
    WHERE destinatario_id = ${destinatarioId} AND NOT lida
  `;
  return row?.total ?? 0;
}

/** Marca UMA notificação como lida (só se for do próprio destinatário). */
export async function marcarLida(
  id: string,
  destinatarioId: string,
): Promise<boolean> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE notificacoes
    SET lida = TRUE, lida_em = NOW()
    WHERE id = ${id} AND destinatario_id = ${destinatarioId} AND NOT lida
  `;
  return atualizado.count > 0;
}

/** Marca TODAS as notificações do destinatário como lidas. */
export async function marcarTodasLidas(destinatarioId: string): Promise<number> {
  const sql = getDatabase();
  const atualizado = await sql`
    UPDATE notificacoes
    SET lida = TRUE, lida_em = NOW()
    WHERE destinatario_id = ${destinatarioId} AND NOT lida
  `;
  return atualizado.count;
}

/** Uma atividade no perfil do usuário — ver `listAtividadesUsuario`. */
export interface AtividadeUsuarioDTO {
  id: string;
  acao: string;
  detalhe: string;
  tempo: string;
  /** Para quem essa ação foi (destinatário da notificação gerada por ela). */
  destinatarioNome: string;
  icone: CartaoIcone;
}

interface LinhaAtividade {
  id: string;
  tipo: string;
  acao: string;
  detalhe: string | null;
  created_at: Date | string;
  destinatario_nome: string;
}

/**
 * Lista as atividades recentes de um usuário — ações que ELE realizou no
 * sistema (não notificações que recebeu). Reaproveita a tabela
 * `notificacoes`: toda ação relevante já grava uma linha com `ator_id`, então
 * "o que o usuário fez" é só inverter a consulta de `listNotificacoes`
 * (que filtra por `destinatario_id`) para filtrar por `ator_id`. Obrigações
 * recorrentes (`ator_id` null, cobradas pelo próprio sistema) não entram.
 */
export async function listAtividadesUsuario(
  usuarioId: string,
  limite = 10,
): Promise<AtividadeUsuarioDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaAtividade[]>`
    SELECT n.id, n.tipo, n.acao, n.detalhe, n.created_at,
           COALESCE(d.nome, 'alguém') AS destinatario_nome
    FROM notificacoes n
    LEFT JOIN users d ON d.id = n.destinatario_id
    WHERE n.ator_id = ${usuarioId}
    ORDER BY n.created_at DESC
    LIMIT ${limite}
  `;

  return linhas.map((linha) => ({
    id: linha.id,
    acao: linha.acao,
    detalhe: linha.detalhe ?? "",
    tempo: tempoRelativo(linha.created_at),
    destinatarioNome: linha.destinatario_nome,
    icone: iconePorTipo(linha.tipo),
  }));
}
