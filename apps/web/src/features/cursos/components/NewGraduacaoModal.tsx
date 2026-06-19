import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Download, Eye, FileText, GraduationCap, Upload, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'

interface NewGraduacaoModalProps {
  children: ReactNode
}

const currentYear = new Date().getFullYear()

function getYearOptions() {
  return Array.from({ length: 60 }, (_, index) => currentYear - index)
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function NewGraduacaoModal({ children }: NewGraduacaoModalProps) {
  const [open, setOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [anoEntrada, setAnoEntrada] = useState('')
  const [anoSaida, setAnoSaida] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const years = useMemo(() => getYearOptions(), [])
  const anosSaida = useMemo(() => {
    if (!anoEntrada) {
      return years
    }

    return years.filter((year) => year >= Number(anoEntrada))
  }, [anoEntrada, years])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  useEffect(() => {
    if (
      anoSaida &&
      anoSaida !== 'presente' &&
      anoEntrada &&
      Number(anoSaida) < Number(anoEntrada)
    ) {
      setAnoSaida('')
    }
  }, [anoEntrada, anoSaida])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setOpen(false)
    toast({
      title: 'Graduação adicionada',
      description: 'O curso foi preparado para cadastro. A integração será adicionada depois.',
      duration: 4000,
    })
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null)
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (selectedFile) return

    setSelectedFile(event.dataTransfer.files[0] ?? null)
  }

  function handleRemoveFile() {
    setSelectedFile(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handlePreviewFile() {
    if (!previewUrl) return

    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  function handleDownloadFile() {
    if (!previewUrl || !selectedFile) return

    const link = document.createElement('a')
    link.href = previewUrl
    link.download = selectedFile.name
    link.click()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Nova graduação</DialogTitle>
              <DialogDescription>
                Adicione as informações do curso de nível superior.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="graduacao-curso">Curso</Label>
            <Input
              id="graduacao-curso"
              name="curso"
              placeholder="Ex: Administração de Empresas"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="graduacao-instituicao">Instituição</Label>
            <Input
              id="graduacao-instituicao"
              name="instituicao"
              placeholder="Ex: Universidade de São Paulo"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="graduacao-ano-entrada">Ano que entrou</Label>
              <Select
                name="anoEntrada"
                required
                value={anoEntrada}
                onValueChange={setAnoEntrada}
              >
                <SelectTrigger id="graduacao-ano-entrada">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="graduacao-ano-saida">Ano que saiu</Label>
              <Select
                name="anoSaida"
                required
                value={anoSaida}
                onValueChange={setAnoSaida}
              >
                <SelectTrigger id="graduacao-ano-saida">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presente">Até o presente</SelectItem>
                  {anosSaida.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3">
            <Label htmlFor="graduacao-diploma">Diploma</Label>
            <Input
              ref={fileInputRef}
              id="graduacao-diploma"
              name="diploma"
              type="file"
              accept="image/*,.pdf"
              multiple={false}
              className="hidden"
              onChange={handleFileChange}
            />

            {!selectedFile && (
              <div
                role="button"
                tabIndex={0}
                className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 bg-background px-6 py-8 text-center outline-none transition-colors hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border bg-background text-muted-foreground">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="font-semibold">Upload do diploma</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Anexe um PDF ou imagem do documento
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                >
                  Selecionar arquivo
                </Button>
              </div>
            )}

            {selectedFile && previewUrl ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {selectedFile.type.startsWith('image/') ? (
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Visualizar diploma"
                    onClick={handlePreviewFile}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Baixar diploma"
                    onClick={handleDownloadFile}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover diploma"
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Adicionar graduação</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
