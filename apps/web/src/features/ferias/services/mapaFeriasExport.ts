import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'

import type { SolicitacaoFerias } from '@/features/ferias/types'

const CABECALHO = ['Nome', 'Período de férias']

/** "YYYY-MM" a partir de uma data ISO ("YYYY-MM-DD"). */
function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

/** Nome do mês por extenso em pt-BR a partir de "YYYY-MM" (ex.: "Outubro de 2026"). */
function nomeDoMes(mesIso: string): string {
  const [ano, mes] = mesIso.split('-').map(Number)
  const rotulo = new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1)
}

/**
 * Gera e baixa o PDF "Mapa de Férias": tabela simples (Nome + Período) de
 * quem entra de férias no mês mais próximo com alguém agendado — mês atual
 * se tiver alguém, senão o próximo mês que tiver (não pula direto pro fim da
 * lista). `vaoEntrar` já vem ordenado por data de início (ver listVisaoGeral
 * no back), então o mês do primeiro item já é exatamente esse mês.
 */
export function exportarMapaFeriasPdf(vaoEntrar: SolicitacaoFerias[]) {
  if (vaoEntrar.length === 0) return

  const mesAlvo = mesDe(vaoEntrar[0].inicio)
  const doMes = vaoEntrar.filter((s) => mesDe(s.inicio) === mesAlvo)

  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text('Mapa de Férias', 14, 16)
  doc.setFontSize(10)
  doc.text(nomeDoMes(mesAlvo), 14, 22)

  autoTable(doc, {
    startY: 28,
    head: [CABECALHO],
    body: doMes.map((s) => [s.funcionarioNome, s.periodo]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] }, // blue-600
  })

  doc.save(`mapa-de-ferias-${mesAlvo}.pdf`)
}
