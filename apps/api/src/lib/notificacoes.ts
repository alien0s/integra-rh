import { getDatabase } from "./database.js";

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

  // Insere uma linha por usuário-destino (SELECT → INSERT em um comando só).
  const inseridos = await sql`
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
  `;
  return inseridos.count;
}

/* ── Listagem / leitura ────────────────────────────────────────────────── */

/** Ícone do cartão no front (mesmos valores do componente). */
type CartaoIcone = "arquivo" | "documento" | "curso";

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
  if (tipo.startsWith("FERIAS")) return "documento";
  if (tipo.startsWith("CURSO")) return "curso";
  return "arquivo";
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
    const nome = linha.ator_nome ?? "Sistema";
    // Só ainda "acionável" se o recurso de origem continuar pendente.
    const aindaPendente = linha.ref_status === null || linha.ref_status === "PENDENTE";
    const requerAcao = linha.requer_acao && aindaPendente;

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
      cartao: requerAcao
        ? {
            titulo: linha.detalhe ?? linha.acao,
            subtitulo: `${nome} • ${tempoRelativo(linha.created_at)}`,
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
