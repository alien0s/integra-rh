/**
 * Utilitários de imagem para recorte (crop) e redução de tamanho no browser,
 * usados pelo modal de troca de foto de perfil.
 */

/** Área de recorte em pixels (formato do react-easy-crop). */
export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

interface CropOptions {
  /** Lado máximo (px) da imagem final — avatar quadrado. Padrão 512. */
  maxSize?: number
  /** Tamanho máximo do arquivo em bytes. Padrão 3 MB. */
  maxBytes?: number
}

/** Carrega uma imagem a partir de uma URL/dataURL. */
function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.addEventListener('load', () => resolve(img))
    img.addEventListener('error', reject)
    img.src = src
  })
}

/** Converte um canvas em Blob JPEG na qualidade informada. */
function canvasParaBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar a imagem'))),
      'image/jpeg',
      quality,
    )
  })
}

/**
 * Recorta a área selecionada, redimensiona para no máximo `maxSize`px e
 * comprime para um JPEG que caiba em `maxBytes` (reduz a qualidade em passos
 * até atingir o limite). Retorna o Blob pronto para upload.
 */
export async function getCroppedBlob(
  imageSrc: string,
  area: CropArea,
  { maxSize = 512, maxBytes = 3 * 1024 * 1024 }: CropOptions = {},
): Promise<Blob> {
  const image = await carregarImagem(imageSrc)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas não suportado neste navegador')
  }

  // Saída quadrada, limitada a maxSize (não amplia além do recorte original).
  const lado = Math.min(maxSize, Math.round(area.width))
  canvas.width = lado
  canvas.height = lado

  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    lado,
    lado,
  )

  // Comprime reduzindo a qualidade até caber no limite de bytes.
  let quality = 0.92
  let blob = await canvasParaBlob(canvas, quality)
  while (blob.size > maxBytes && quality > 0.4) {
    quality -= 0.1
    blob = await canvasParaBlob(canvas, quality)
  }

  return blob
}

/** Lê um File como dataURL (base64), usado para alimentar o cropper. */
export function lerArquivoComoDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result as string))
    reader.addEventListener('error', reject)
    reader.readAsDataURL(file)
  })
}
