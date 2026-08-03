import type { Notificacao } from '@/features/notificacoes/types'

/**
 * Service de Notificações.
 * Mock por enquanto (vira chamada à API quando o backend existir).
 */

const mockNotificacoes: Notificacao[] = [
  {
    id: '1',
    nome: 'Marcos',
    acao: 'aprovou seu certificado de nível superior',
    detalhe: 'Administração de Empresas',
    tempo: '2 min',
    avatar: 'https://i.pravatar.cc/96?img=13',
    iniciais: 'MA',
    lida: false,
  },
  {
    id: '2',
    nome: 'Juliana',
    acao: 'solicitou acesso ao curso',
    detalhe: 'Gestão de Pessoas',
    tempo: '18 min',
    avatar: 'https://i.pravatar.cc/96?img=45',
    iniciais: 'JU',
    lida: false,
    cartao: {
      titulo: 'MBA em Gestão de Pessoas',
      subtitulo: 'Atualizado há 12 min',
      icone: 'curso',
    },
    requerAcao: true,
  },
  {
    id: '3',
    nome: 'Renata',
    acao: 'enviou um documento para revisão',
    detalhe: 'Histórico acadêmico',
    tempo: '1 h',
    avatar: 'https://i.pravatar.cc/96?img=29',
    iniciais: 'RE',
    lida: false,
    cartao: {
      titulo: 'Histórico acadêmico.pdf',
      subtitulo: 'Enviado há 1 hora',
      icone: 'documento',
    },
    requerAcao: true,
  },
  {
    id: '4',
    nome: 'Carlos',
    acao: 'validou sua declaração de curso',
    detalhe: 'Excel avançado para dashboards',
    tempo: 'Ontem',
    avatar: 'https://i.pravatar.cc/96?img=60',
    iniciais: 'CA',
    lida: true,
  },
]

export const notificacoesService = {
  /** Lista as notificações do usuário. */
  async getNotificacoes(): Promise<Notificacao[]> {
    return mockNotificacoes
  },
}
