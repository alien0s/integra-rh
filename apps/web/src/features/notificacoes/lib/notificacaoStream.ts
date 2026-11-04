import { getToken } from '@/lib/auth'

/**
 * Conexão SSE ÚNICA e compartilhada com `GET /notificacoes/stream` — um
 * EventSource por aba, não um por componente. Vários lugares precisam reagir
 * em tempo real a "algo mudou" (o sino de notificações, o card de férias do
 * dashboard, etc.); todos assinam aqui em vez de abrir a própria conexão.
 *
 * Por quê: o navegador limita conexões HTTP/1.1 simultâneas por domínio
 * (~6), e cada conexão aberta também vira uma entrada a mais no registro em
 * memória do backend (ver `registrarCliente`/`notificarClientes` em
 * notificacoesStream.ts) com seu próprio ping a cada 25s — abrir uma por
 * componente desperdiça as duas pontas à toa. A conexão real só existe
 * enquanto houver pelo menos 1 assinante; fecha sozinha quando o último sai.
 */

type Ouvinte = () => void

let conexao: EventSource | null = null
const ouvintes = new Set<Ouvinte>()

function garantirConexao(): void {
  if (conexao) return
  const token = getToken()
  if (!token) return

  const es = new EventSource(
    `/api/notificacoes/stream?token=${encodeURIComponent(token)}`,
  )
  es.addEventListener('notificacao', () => {
    for (const ouvinte of ouvintes) ouvinte()
  })
  conexao = es
}

function fecharSeOcioso(): void {
  if (ouvintes.size === 0 && conexao) {
    conexao.close()
    conexao = null
  }
}

/**
 * Assina o evento "há novidade" em tempo real (SSE). Retorna uma função para
 * cancelar a assinatura (chamar no cleanup do `useEffect`).
 */
export function assinarNotificacoes(ouvinte: Ouvinte): () => void {
  garantirConexao()
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
    fecharSeOcioso()
  }
}
