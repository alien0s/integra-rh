import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, Upload } from 'lucide-react'

import { AvatarCropModal } from '@/components/RH/AvatarCropModal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { lerArquivoComoDataURL } from '@/lib/image'
import { cn } from '@/lib/utils'

interface AvatarUploaderProps {
  /** URL atual do avatar (opcional). */
  src?: string
  /** Nome para o alt da imagem. */
  nome?: string
  /** Iniciais exibidas no fallback. */
  iniciais?: string
  /** Classe de tamanho do avatar (ex.: "h-24 w-24"). */
  className?: string
  /** Exibe os botões (Adicionar/Atualizar foto + Remover) ao lado do avatar. */
  withActions?: boolean
  /**
   * Persiste o novo avatar (Blob já recortado). Opcional: se ausente, o
   * componente só mostra o preview local (sem enviar).
   */
  onUpload?: (blob: Blob) => Promise<void> | void
  /** Remove a foto (persistência). Opcional; sem ele, remove só no front. */
  onRemove?: () => Promise<void> | void
}

/**
 * Avatar clicável que abre o explorer → modal de recorte → mostra a foto na
 * hora (preview local) e chama onUpload em segundo plano. Centraliza todo o
 * fluxo de troca de foto para reuso entre telas (perfil, configurações...).
 *
 * Com `withActions`, exibe ao lado um botão principal (Adicionar/Atualizar
 * foto) e um botão Remover.
 */
export function AvatarUploader({
  src,
  nome,
  iniciais,
  className = 'h-24 w-24',
  withActions = false,
  onUpload,
  onRemove,
}: AvatarUploaderProps) {
  const inputFileRef = useRef<HTMLInputElement>(null)
  const [imagemSelecionada, setImagemSelecionada] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Preview local (object URL) da foto recém-recortada.
  const [preview, setPreview] = useState<string | null>(null)
  // Marca que a foto foi removida no front (ignora o src recebido).
  const [removido, setRemovido] = useState(false)

  // Libera o object URL ao desmontar (evita vazamento de memória).
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const fotoAtual = removido ? undefined : (preview ?? src)
  const temFoto = Boolean(fotoAtual)

  function abrirExplorer() {
    inputFileRef.current?.click()
  }

  async function handleArquivo(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite reselecionar o mesmo arquivo
    if (!file) return

    setImagemSelecionada(await lerArquivoComoDataURL(file))
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
    setImagemSelecionada(null)
  }

  async function handleConfirmar(blob: Blob) {
    setRemovido(false)
    setPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return URL.createObjectURL(blob)
    })
    fecharModal()

    if (!onUpload) return

    setEnviando(true)
    try {
      await onUpload(blob)
    } catch {
      // Em produção: exibir toast. O preview local permanece visível.
    } finally {
      setEnviando(false)
    }
  }

  function handleRemover() {
    setPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return null
    })
    setRemovido(true)
    onRemove?.()
  }

  const avatarButton = (
    <button
      type="button"
      onClick={abrirExplorer}
      className={cn(
        'group relative shrink-0 overflow-hidden rounded-lg',
        className,
      )}
      aria-label="Trocar foto"
    >
      <Avatar className="h-full w-full rounded-lg">
        <AvatarImage src={fotoAtual} alt={nome} className="rounded-lg" />
        <AvatarFallback className="rounded-lg bg-primary/10 font-semibold text-primary">
          {iniciais}
        </AvatarFallback>
      </Avatar>
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
        <Camera className="h-5 w-5" />
        Trocar foto
      </span>
    </button>
  )

  return (
    <>
      {withActions ? (
        <div className="flex items-center gap-4">
          {avatarButton}
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              size="sm"
              onClick={abrirExplorer}
              disabled={enviando}
            >
              <Upload className="h-4 w-4" />
              {temFoto ? 'Atualizar foto' : 'Adicionar foto'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemover}
              disabled={!temFoto || enviando}
              className="text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          </div>
        </div>
      ) : (
        avatarButton
      )}

      <input
        ref={inputFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleArquivo}
      />

      <AvatarCropModal
        open={modalAberto}
        imageSrc={imagemSelecionada}
        isUploading={enviando}
        onCancel={fecharModal}
        onConfirm={handleConfirmar}
      />
    </>
  )
}
