import type { Usuario } from '@/features/usuarios/types'

/**
 * Dados temporários usados pela listagem e pelo detalhe de usuários.
 */
export const usuarios: Usuario[] = [
  {
    id: 'ana-carolina-souza',
    nome: 'Ana Carolina Souza',
    email: 'ana.souza@aceam.org.br',
    funcao: 'Analista de RH',
    departamento: 'Gestão de Pessoas',
    status: 'Ativo',
    fotoUrl: 'https://i.pravatar.cc/160?img=47',
    iniciais: 'AS',
  },
  {
    id: 'bruno-martins',
    nome: 'Bruno Martins',
    email: 'bruno.martins@aceam.org.br',
    funcao: 'Coordenador Financeiro',
    departamento: 'Finanças',
    status: 'Inativo',
    fotoUrl: 'https://i.pravatar.cc/160?img=12',
    iniciais: 'BM',
  },
  {
    id: 'camila-rocha',
    nome: 'Camila Rocha',
    email: 'camila.rocha@aceam.org.br',
    funcao: 'Supervisora Pedagógica',
    departamento: 'Educação',
    status: 'Ativo',
    fotoUrl: 'https://i.pravatar.cc/160?img=32',
    iniciais: 'CR',
  },
  {
    id: 'diego-almeida',
    nome: 'Diego Almeida',
    email: 'diego.almeida@aceam.org.br',
    funcao: 'Analista de Sistemas',
    departamento: 'Tecnologia',
    status: 'Ativo',
    fotoUrl: 'https://i.pravatar.cc/160?img=68',
    iniciais: 'DA',
  },
  {
    id: 'fernanda-lima',
    nome: 'Fernanda Lima',
    email: 'fernanda.lima@aceam.org.br',
    funcao: 'Assistente Administrativo',
    departamento: 'Administrativo',
    status: 'Inativo',
    fotoUrl: 'https://i.pravatar.cc/160?img=49',
    iniciais: 'FL',
  },
]
