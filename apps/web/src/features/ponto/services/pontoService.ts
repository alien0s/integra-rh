import type { FuncionarioPonto, RegistroPonto } from '@/features/ponto/types'

/**
 * Service de Ponto — dados dos registros de jornada.
 * Mock por enquanto (vira chamada à API quando o backend existir).
 */

const FUNCS: Record<string, FuncionarioPonto> = {
  ana: { nome: 'Ana Carolina Souza', fotoUrl: 'https://i.pravatar.cc/96?img=47', iniciais: 'AS' },
  bruno: { nome: 'Bruno Martins', fotoUrl: 'https://i.pravatar.cc/96?img=12', iniciais: 'BM' },
  camila: { nome: 'Camila Rocha', fotoUrl: 'https://i.pravatar.cc/96?img=32', iniciais: 'CR' },
  diego: { nome: 'Diego Almeida', fotoUrl: 'https://i.pravatar.cc/96?img=68', iniciais: 'DA' },
  fernanda: { nome: 'Fernanda Lima', fotoUrl: 'https://i.pravatar.cc/96?img=26', iniciais: 'FL' },
}

const mockRegistros: RegistroPonto[] = [
  {
    id: '1',
    funcionario: FUNCS.ana,
    diaSemana: 'SEG',
    data: '01/05',
    jornada: 'Escritório 08h às 18h',
    entrada: { valor: '07:50', status: 'ok' },
    intervalo: { valor: '12:00', status: 'ok' },
    fimIntervalo: { valor: 'Faltando', status: 'vazio' },
    saida: { valor: '18:00', status: 'ok' },
    trabalhado: '08:10',
  },
  {
    id: '2',
    funcionario: FUNCS.bruno,
    diaSemana: 'TER',
    data: '02/05',
    jornada: 'Escritório 08h às 18h',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '12:00', status: 'ok' },
    fimIntervalo: { valor: '13:00', status: 'alerta' },
    saida: { valor: '22:00', status: 'erro' },
    trabalhado: '—',
  },
  {
    id: '3',
    funcionario: FUNCS.camila,
    diaSemana: 'QUA',
    data: '03/05',
    jornada: 'Escritório 08h às 18h',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '12:00', status: 'ok' },
    fimIntervalo: { valor: '13:00', status: 'ok' },
    saida: { valor: '18:00', status: 'ok' },
    trabalhado: '08:00',
  },
  {
    id: '4',
    funcionario: FUNCS.diego,
    diaSemana: 'QUI',
    data: '04/05',
    jornada: 'Assistente',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '12:00', status: 'ok' },
    fimIntervalo: { valor: '13:00', status: 'ok' },
    saida: { valor: '17:30', status: 'alerta' },
    trabalhado: '07:30',
  },
  {
    id: '5',
    funcionario: FUNCS.fernanda,
    diaSemana: 'SEX',
    data: '05/05',
    jornada: 'Assistente',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '12:00', status: 'ok' },
    fimIntervalo: { valor: '13:00', status: 'ok' },
    saida: { valor: '18:00', status: 'ok' },
    trabalhado: '08:00',
  },
  {
    id: '6',
    funcionario: FUNCS.ana,
    diaSemana: 'SÁB',
    data: '06/05',
    jornada: 'Assistente',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '11:30', status: 'ok' },
    fimIntervalo: { valor: '12:30', status: 'ok' },
    saida: { valor: '18:00', status: 'ok' },
    trabalhado: '08:00',
    fimDeSemana: true,
  },
  {
    id: '7',
    funcionario: FUNCS.bruno,
    diaSemana: 'DOM',
    data: '07/05',
    jornada: 'Escritório 08h às 18h',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '11:30', status: 'ok' },
    fimIntervalo: { valor: '12:30', status: 'ok' },
    saida: { valor: '18:00', status: 'ok' },
    trabalhado: '08:00',
    fimDeSemana: true,
  },
  {
    id: '8',
    funcionario: FUNCS.camila,
    diaSemana: 'SEG',
    data: '08/05',
    jornada: 'Escritório 08h às 18h',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '11:30', status: 'alerta' },
    fimIntervalo: { valor: '12:30', status: 'ok' },
    saida: { valor: '18:00', status: 'ok' },
    trabalhado: '08:00',
  },
  {
    id: '9',
    funcionario: FUNCS.diego,
    diaSemana: 'TER',
    data: '09/05',
    jornada: 'Escritório 08h às 18h',
    entrada: { valor: '08:00', status: 'ok' },
    intervalo: { valor: '11:30', status: 'ok' },
    fimIntervalo: { valor: '12:30', status: 'alerta' },
    saida: { valor: '18:00', status: 'ok' },
    trabalhado: '08:00',
  },
]

export const pontoService = {
  /**
   * Retorna os registros de ponto do período.
   */
  async getRegistros(): Promise<RegistroPonto[]> {
    return Promise.resolve(mockRegistros)
  },
}
