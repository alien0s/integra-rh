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
type CartaoIcone = "arquivo" | "documento" | "curso" | "obrigacao" | "folga";

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
  /**
   * Tem um arquivo anexado pra ver antes de decidir (diploma/certificado —
   * ver formação acadêmica/curso em qualificacoes_academicas/qualificacoes_cursos).
   * Idiomas nunca têm (não há anexo nessa tabela).
   */
  temArquivo?: boolean;
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
  ref_status: string | null; // status atual do recurso (ferias ou qualificações)
  tem_anexo: boolean;
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
  if (tipo.startsWith("FOLGA")) return "folga";
  if (tipo.startsWith("FERIAS")) return "documento";
  if (tipo.startsWith("CURSO")) return "curso";
  return "arquivo";
}

/** Tabelas de qualificações (Cursos e Qualificações) — aprovação de 1 etapa só (RH). */
const TABELAS_QUALIFICACAO = new Set([
  "qualificacoes_academicas",
  "qualificacoes_cursos",
  "qualificacoes_idiomas",
]);

/**
 * Uma notificação acionável só mostra os botões enquanto o recurso de
 * origem estiver no status que aquela ETAPA decide:
 *   - Férias: FERIAS_SOLICITADA (card do gestor) → acionável enquanto
 *     PENDENTE; FERIAS_AGUARDA_DP (card do DP) → acionável enquanto
 *     APROVADO_GESTOR.
 *   - Cursos e Qualificações (formação/curso/idioma): uma etapa só (RH) →
 *     acionável enquanto PENDENTE.
 * Assim o botão certo aparece pro ator certo e some depois de decidido (por
 * qualquer um dos RH, já que a fila é compartilhada). Outras notificações
 * mantêm o comportamento anterior (sempre acionável).
 */
function acionavelPorEtapa(
  tipo: string,
  referenciaTabela: string | null,
  refStatus: string | null,
): boolean {
  if (referenciaTabela === "ferias_solicitacoes") {
    if (tipo.endsWith("_SOLICITADA")) return refStatus === "PENDENTE";
    if (tipo.endsWith("_AGUARDA_DP")) return refStatus === "APROVADO_GESTOR";
    return refStatus === "PENDENTE";
  }
  if (referenciaTabela && TABELAS_QUALIFICACAO.has(referenciaTabela)) {
    return refStatus === "PENDENTE";
  }
  return true;
}

/** Lista as notificações de um destinatário (mais recentes primeiro). */
export async function listNotificacoes(
  destinatarioId: string,
): Promise<NotificacaoDTO[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaNotificacao[]>`
    SELECT n.id, n.tipo, n.acao, n.detalhe, n.requer_acao, n.lida, n.created_at,
           n.referencia_tabela, n.referencia_id,
           COALESCE(fs.status, qa.status, qc.status, qi.status) AS ref_status,
           CASE
             WHEN n.referencia_tabela = 'qualificacoes_academicas' THEN qa.anexo_url IS NOT NULL
             WHEN n.referencia_tabela = 'qualificacoes_cursos' THEN qc.certificado_url IS NOT NULL
             ELSE FALSE
           END AS tem_anexo,
           n.ator_id      AS ator_id,
           a.nome         AS ator_nome,
           a.avatar_url   AS ator_avatar
    FROM notificacoes n
    LEFT JOIN users a ON a.id = n.ator_id
    LEFT JOIN ferias_solicitacoes fs
      ON n.referencia_tabela = 'ferias_solicitacoes' AND fs.id = n.referencia_id
    LEFT JOIN qualificacoes_academicas qa
      ON n.referencia_tabela = 'qualificacoes_academicas' AND qa.id = n.referencia_id
    LEFT JOIN qualificacoes_cursos qc
      ON n.referencia_tabela = 'qualificacoes_cursos' AND qc.id = n.referencia_id
    LEFT JOIN qualificacoes_idiomas qi
      ON n.referencia_tabela = 'qualificacoes_idiomas' AND qi.id = n.referencia_id
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
      temArquivo: linha.tem_anexo,
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

/**
 * Papéis "importantes" (quem de fato decide em férias/qualificações) — uma
 * atividade só aparece pra quem NÃO é o dono do perfil quando a contraparte
 * (quem fez, ou pra quem foi, dependendo do lado) tem um desses papéis. Dono
 * do perfil sempre vê tudo (ver a rota GET /usuarios/:id/atividades).
 * ADMIN não entra de propósito — é sempre privilegiado no resto do sistema,
 * mas não necessariamente "importante" nesse recorte social/HR específico.
 */
const PAPEIS_IMPORTANTES_ATIVIDADE = new Set(["RH", "DP", "COORDENADOR DP"]);

/** Uma atividade no perfil do usuário — ver `listAtividadesUsuario`. */
export interface AtividadeUsuarioDTO {
  id: string;
  acao: string;
  detalhe: string;
  tempo: string;
  /** Nome da outra pessoa envolvida — pra quem foi (se o dono do perfil foi
   * quem agiu) ou quem fez (se algo aconteceu pro dono do perfil). */
  contraparteNome: string;
  /** true = o dono do perfil foi quem agiu; false = alguém agiu sobre ele
   * (ex.: aprovou suas férias/seu diploma). */
  euFizFoi: boolean;
  icone: CartaoIcone;
}

interface LinhaAtividade {
  id: string;
  tipo: string;
  acao: string;
  detalhe: string | null;
  created_at: Date | string;
  ator_id: string | null;
  ator_nome: string | null;
  ator_papel: string | null;
  destinatario_nome: string | null;
  destinatario_papel: string | null;
}

/**
 * Lista as atividades recentes de um usuário: o que ELE fez (ator) E o que
 * ACONTECEU pra ele (destinatário de uma decisão de outra pessoa — ex.:
 * "RH aprovou seu diploma"). Reaproveita a tabela `notificacoes`. Lembretes
 * do sistema (obrigações recorrentes, `ator_id` null) nunca entram — nem no
 * lado "o que ele fez" (óbvio, não tem ator) nem no lado "o que aconteceu
 * pra ele" (filtrado explicitamente, ver WHERE).
 *
 * `apenasImportantes`: quando true (perfil visto por OUTRA pessoa — ver a
 * rota), só mostra a atividade se a contraparte (quem não é o dono do
 * perfil, nos dois lados) tiver um papel em PAPEIS_IMPORTANTES_ATIVIDADE.
 * O dono do próprio perfil (`apenasImportantes: false`) sempre vê tudo.
 */
export async function listAtividadesUsuario(
  usuarioId: string,
  opts: { apenasImportantes?: boolean; limite?: number } = {},
): Promise<AtividadeUsuarioDTO[]> {
  const { apenasImportantes = false, limite = 10 } = opts;
  const sql = getDatabase();
  // Busca uma janela maior que `limite`: quando `apenasImportantes` descarta
  // boa parte, ainda sobra o suficiente pra completar o `limite` pedido.
  const linhas = await sql<LinhaAtividade[]>`
    SELECT n.id, n.tipo, n.acao, n.detalhe, n.created_at, n.ator_id,
           at.nome    AS ator_nome,
           ar.codigo  AS ator_papel,
           d.nome     AS destinatario_nome,
           dr.codigo  AS destinatario_papel
    FROM notificacoes n
    LEFT JOIN users at ON at.id = n.ator_id
    LEFT JOIN roles ar ON ar.id = at.role_id
    LEFT JOIN users d  ON d.id  = n.destinatario_id
    LEFT JOIN roles dr ON dr.id = d.role_id
    WHERE n.ator_id = ${usuarioId}
       OR (n.destinatario_id = ${usuarioId} AND n.ator_id IS NOT NULL AND n.ator_id <> ${usuarioId})
    ORDER BY n.created_at DESC
    LIMIT ${limite * 3}
  `;

  const mapeadas = linhas.map((linha) => {
    const euFizFoi = linha.ator_id === usuarioId;
    const contrapartePapel = euFizFoi ? linha.destinatario_papel : linha.ator_papel;
    const importante = Boolean(contrapartePapel && PAPEIS_IMPORTANTES_ATIVIDADE.has(contrapartePapel));
    const dto: AtividadeUsuarioDTO = {
      id: linha.id,
      acao: linha.acao,
      detalhe: linha.detalhe ?? "",
      tempo: tempoRelativo(linha.created_at),
      contraparteNome: (euFizFoi ? linha.destinatario_nome : linha.ator_nome) ?? "alguém",
      euFizFoi,
      icone: iconePorTipo(linha.tipo),
    };
    return { dto, importante };
  });

  return mapeadas
    .filter((item) => !apenasImportantes || item.importante)
    .slice(0, limite)
    .map((item) => item.dto);
}
