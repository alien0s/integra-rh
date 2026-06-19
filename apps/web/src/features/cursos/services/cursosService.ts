import type { CursosData } from '../types'

const mockData: CursosData = {
  stats: {
    formados: { count: 128, total: 160, trend: 2.8 },
    emFormacao: { count: 67, total: 160, trend: 3.5 },
    cursosRapidos: { count: 94, total: 160, trend: -1.9 },
  },
  formacoes: [
    {
      id: '1',
      curso: 'Graduação em Administração de Empresas',
      instituicao: 'Universidade de São Paulo (USP)',
      periodo: '2018 - 2022',
      status: 'CONCLUÍDO',
      verificado: true,
    },
    {
      id: '2',
      curso: 'MBA em Gestão Estratégica de Pessoas',
      instituicao: 'Fundação Getulio Vargas (FGV)',
      periodo: '2023 - Presente',
      status: 'EM ANDAMENTO',
    },
  ],
  idiomas: [
    { id: '1', idioma: 'Inglês', nivel: 'Avançado (C1)', progresso: 85 },
    { id: '2', idioma: 'Espanhol', nivel: 'Intermediário (B2)', progresso: 50 },
    { id: '3', idioma: 'Francês', nivel: 'Básico (A2)', progresso: 25 },
  ],
  certificacoes: [
    {
      id: '1',
      nome: 'PMP - Project Management Professional',
      emissor: 'PMI Institute',
      validade: 'Expira em jan. 2026',
      icone: 'shield',
    },
    {
      id: '2',
      nome: 'AWS Certified Cloud Practitioner',
      emissor: 'Amazon Web Services',
      validade: 'Emitido em 2023',
      icone: 'cloud',
    },
  ],
  cursos: [
    {
      id: '1',
      nome: 'Liderança de Equipes de Alta Performance',
      escola: 'Escola de Gestão',
      cargaHoraria: '40h',
      ano: '2024',
      linkCertificado: '#',
    },
    {
      id: '2',
      nome: 'Excel Avançado para Dashboards',
      escola: 'LinkedIn Learning',
      cargaHoraria: '16h',
      ano: '2023',
      linkCertificado: '#',
    },
    {
      id: '3',
      nome: 'Design Thinking em Processos de RH',
      escola: 'Workshop interno',
      cargaHoraria: '8h',
      ano: '2023',
      linkCertificado: '#',
    },
  ],
  funcionariosCursosSuperiores: [
    {
      id: '1',
      nome: 'Ana Carolina Souza',
      cargo: 'Analista de RH',
      departamento: 'Gestão de Pessoas',
      fotoUrl: 'https://i.pravatar.cc/96?img=47',
      iniciais: 'AS',
      cursosSuperiores: ['Administração', 'Gestão de Pessoas', 'Psicologia Organizacional'],
      emAndamento: [],
      cursosRapidos: ['Liderança (Curso rápido)'],
    },
    {
      id: '2',
      nome: 'Bruno Martins',
      cargo: 'Coordenador Financeiro',
      departamento: 'Finanças',
      fotoUrl: 'https://i.pravatar.cc/96?img=12',
      iniciais: 'BM',
      cursosSuperiores: ['Ciências Contábeis', 'Economia'],
      emAndamento: ['Gestão Financeira'],
      cursosRapidos: [],
    },
    {
      id: '3',
      nome: 'Camila Rocha',
      cargo: 'Supervisora Pedagógica',
      departamento: 'Educação',
      fotoUrl: 'https://i.pravatar.cc/96?img=32',
      iniciais: 'CR',
      cursosSuperiores: ['Pedagogia', 'Letras', 'Psicopedagogia', 'Gestão Escolar'],
      emAndamento: ['Design Instrucional'],
      cursosRapidos: ['Workshop de Educação Inclusiva'],
    },
    {
      id: '4',
      nome: 'Diego Almeida',
      cargo: 'Analista de Sistemas',
      departamento: 'Tecnologia',
      fotoUrl: 'https://i.pravatar.cc/96?img=68',
      iniciais: 'DA',
      cursosSuperiores: ['Sistemas de Informação'],
      emAndamento: [],
      cursosRapidos: ['AWS Cloud', 'Cibersegurança (Workshop)'],
    },
    {
      id: '5',
      nome: 'Fernanda Lima',
      cargo: 'Assistente Administrativo',
      departamento: 'Administrativo',
      fotoUrl: 'https://i.pravatar.cc/96?img=26',
      iniciais: 'FL',
      cursosSuperiores: [],
      emAndamento: ['Administração'],
      cursosRapidos: ['Excel Avançado'],
    },
  ],
}

export const cursosService = {
  /**
   * Busca os dados completos de cursos e qualificações.
   */
  async getCursosData(): Promise<CursosData> {
    return new Promise((resolve) => {
      setTimeout(() => resolve(mockData), 400)
    })
  },
}
