import { jsPDF } from 'jspdf'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

/**
 * Compactação de PDF no browser, usada quando o diploma/certificado
 * escaneado passa do limite de upload (ver TAMANHO_MAXIMO_ANEXO_BYTES em
 * lib/cursos.ts). Rasteriza cada página (pdf.js) e reencaixa como JPEG num
 * PDF novo (jsPDF, já usado no projeto pra exportação) — funciona bem porque
 * o motivo comum de um diploma pesar demais é a imagem escaneada embutida,
 * não o texto/vetor em si.
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

interface PaginaRenderizada {
  canvas: HTMLCanvasElement
  larguraPt: number
  alturaPt: number
}

async function renderizarPagina(
  pagina: pdfjsLib.PDFPageProxy,
  escala: number,
): Promise<PaginaRenderizada> {
  const viewport = pagina.getViewport({ scale: escala })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)

  await pagina.render({ canvas, viewport }).promise

  // Dimensão da página em pt (escala 1 = unidade nativa do PDF, 1/72"),
  // pra montar o PDF de saída do mesmo tamanho independente da resolução
  // usada pra rasterizar.
  const base = pagina.getViewport({ scale: 1 })
  return { canvas, larguraPt: base.width, alturaPt: base.height }
}

function montarPdf(paginas: PaginaRenderizada[], qualidade: number): Blob {
  const [primeira, ...resto] = paginas
  const doc = new jsPDF({
    unit: 'pt',
    format: [primeira.larguraPt, primeira.alturaPt],
    orientation: primeira.larguraPt > primeira.alturaPt ? 'landscape' : 'portrait',
  })
  doc.addImage(
    primeira.canvas.toDataURL('image/jpeg', qualidade),
    'JPEG',
    0,
    0,
    primeira.larguraPt,
    primeira.alturaPt,
  )

  for (const pagina of resto) {
    doc.addPage(
      [pagina.larguraPt, pagina.alturaPt],
      pagina.larguraPt > pagina.alturaPt ? 'landscape' : 'portrait',
    )
    doc.addImage(pagina.canvas.toDataURL('image/jpeg', qualidade), 'JPEG', 0, 0, pagina.larguraPt, pagina.alturaPt)
  }

  return doc.output('blob')
}

export interface ComprimirPdfOptions {
  /** Tamanho máximo do arquivo final, em bytes. */
  maxBytes?: number
}

/**
 * Compacta `arquivo` (PDF) até caber em `maxBytes`. Tenta primeiro numa
 * resolução mais nítida, reduzindo só a qualidade do JPEG em passos; se nem
 * a qualidade mínima bastar, cai pra uma resolução menor e repete. Lança um
 * erro se não conseguir reduzir o suficiente (PDF com muitas páginas de alta
 * resolução, por exemplo).
 */
export async function comprimirPdf(
  arquivo: File,
  { maxBytes = 5 * 1024 * 1024 }: ComprimirPdfOptions = {},
): Promise<File> {
  const bytes = await arquivo.arrayBuffer()
  const documento = await pdfjsLib.getDocument({ data: bytes }).promise

  for (const escala of [2, 1.3, 0.9]) {
    const paginas: PaginaRenderizada[] = []
    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      paginas.push(await renderizarPagina(await documento.getPage(numero), escala))
    }

    for (let qualidade = 0.85; qualidade >= 0.35; qualidade -= 0.15) {
      const blob = montarPdf(paginas, qualidade)
      if (blob.size <= maxBytes) {
        return new File([blob], arquivo.name, { type: 'application/pdf' })
      }
    }
  }

  throw new Error('Não foi possível reduzir o PDF abaixo do limite permitido.')
}
