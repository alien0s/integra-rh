import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import * as XLSX from 'xlsx'

import type { Usuario } from '@/features/usuarios/types'

/**
 * Geração de arquivos (Excel/PDF) com a lista de usuários.
 * Tabela simples: Nome, E-mail, Função, Departamento e Telefone.
 */

const CABECALHO = ['Nome', 'E-mail', 'Função', 'Departamento', 'Telefone']

/** Converte os usuários em linhas [nome, email, funcao, depto, telefone]. */
function linhas(usuarios: Usuario[]): string[][] {
  return usuarios.map((u) => [
    u.nome,
    u.email,
    u.funcao,
    u.departamento,
    u.telefone ?? '',
  ])
}

/** Gera e baixa uma planilha .xlsx com os usuários. */
export function exportarUsuariosExcel(usuarios: Usuario[]) {
  const dados = usuarios.map((u) => ({
    Nome: u.nome,
    'E-mail': u.email,
    Função: u.funcao,
    Departamento: u.departamento,
    Telefone: u.telefone ?? '',
  }))

  const planilha = XLSX.utils.json_to_sheet(dados)
  const pasta = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(pasta, planilha, 'Usuários')
  XLSX.writeFile(pasta, 'usuarios.xlsx')
}

/** Gera e baixa um PDF com os usuários em tabela. */
export function exportarUsuariosPdf(usuarios: Usuario[]) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Usuários', 14, 16)

  autoTable(doc, {
    startY: 22,
    head: [CABECALHO],
    body: linhas(usuarios),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] }, // blue-600
  })

  doc.save('usuarios.pdf')
}
