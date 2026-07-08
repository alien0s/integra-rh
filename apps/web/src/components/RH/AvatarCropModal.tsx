import { useState } from 'react'
import Cropper from 'react-easy-crop'
import { Check, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getCroppedBlob, type CropArea } from '@/lib/image'

interface AvatarCropModalProps {
  /** Controla a visibilidade do modal. */
  open: boolean
  /** dataURL da imagem selecionada pelo usuário. */
  imageSrc: string | null
  /** Indica que o upload está em andamento. */
  isUploading?: boolean
  /** Cancela e fecha o modal. */
  onCancel: () => void
  /** Recebe o recorte final (já redimensionado/comprimido) para upload. */
  onConfirm: (blob: Blob) => void
}

/**
 * Modal de recorte de foto de perfil. Usa react-easy-crop para selecionar a
 * área (quadrada) e o utilitário getCroppedBlob para gerar um JPEG reduzido
 * (≤ 3 MB) antes do upload.
 */
export function AvatarCropModal({
  open,
  imageSrc,
  isUploading = false,
  onCancel,
  onConfirm,
}: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPixels, setAreaPixels] = useState<CropArea | null>(null)
  const [processando, setProcessando] = useState(false)

  async function handleConfirmar() {
    if (!imageSrc || !areaPixels) return
    setProcessando(true)
    try {
      const blob = await getCroppedBlob(imageSrc, areaPixels)
      onConfirm(blob)
    } finally {
      setProcessando(false)
    }
  }

  const ocupado = processando || isUploading

  return (
    <Dialog open={open} onOpenChange={(aberto) => !aberto && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
          <DialogDescription>
            Arraste para posicionar e use o controle para ampliar. A imagem é
            recortada em formato quadrado.
          </DialogDescription>
        </DialogHeader>

        {/* Área do cropper — precisa de container posicionado com altura fixa */}
        <div className="relative h-72 w-full overflow-hidden rounded-lg bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setAreaPixels(pixels)}
            />
          ) : null}
        </div>

        {/* Controle de zoom */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 w-full cursor-pointer accent-primary"
            aria-label="Zoom da imagem"
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={ocupado}>
            <X className="h-4 w-4" />
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirmar} disabled={ocupado || !areaPixels}>
            <Check className="h-4 w-4" />
            {ocupado ? 'Enviando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
