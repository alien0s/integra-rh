/**
 * Registro em memória das conexões SSE (Server-Sent Events) de notificações,
 * por usuário. Quando uma notificação é criada (ver emitir* em notificacoes.ts),
 * empurramos um evento "atualize" para as conexões abertas daquele usuário —
 * dando notificação em TEMPO REAL, sem depender do polling.
 *
 * É um Map em memória do processo: simples e suficiente para um único processo.
 * Se um dia a API rodar em vários processos/instâncias, isto precisaria de um
 * pub/sub (ex.: Redis) para propagar entre eles.
 */

/** Uma conexão aberta — só sabe escrever um chunk no stream. */
interface ClienteSSE {
  write: (chunk: string) => void;
}

const conexoesPorUsuario = new Map<string, Set<ClienteSSE>>();

/**
 * Registra uma conexão SSE de um usuário. Retorna uma função para removê-la
 * (chamar quando a conexão fechar).
 */
export function registrarCliente(userId: string, cliente: ClienteSSE): () => void {
  let conjunto = conexoesPorUsuario.get(userId);
  if (!conjunto) {
    conjunto = new Set();
    conexoesPorUsuario.set(userId, conjunto);
  }
  conjunto.add(cliente);

  return () => {
    const atual = conexoesPorUsuario.get(userId);
    if (!atual) return;
    atual.delete(cliente);
    if (atual.size === 0) conexoesPorUsuario.delete(userId);
  };
}

/**
 * Empurra um evento SSE de "há novidade" para os usuários informados. O payload
 * é vazio de propósito — é só um gatilho; o cliente refaz o GET /notificacoes
 * (reaproveita a lógica de listagem e dispara os toasts das novas).
 */
export function notificarClientes(userIds: Iterable<string>): void {
  const mensagem = "event: notificacao\ndata: {}\n\n";
  const jaEnviados = new Set<string>();
  for (const id of userIds) {
    if (jaEnviados.has(id)) continue;
    jaEnviados.add(id);
    const conjunto = conexoesPorUsuario.get(id);
    if (!conjunto) continue;
    for (const cliente of conjunto) {
      try {
        cliente.write(mensagem);
      } catch {
        /* conexão morta: será removida no 'close' do request */
      }
    }
  }
}
