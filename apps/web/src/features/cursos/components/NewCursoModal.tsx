import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Award, BookOpen, Download, Eye, FileText, Upload, X } from 'lucide-react'

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
import type { CursoQualificacao, NovoCursoInput, TipoCursoQualificacao } from '../types'

interface NewCursoModalProps {
  children: ReactNode
  /** CERTIFICACAO trava o tipo; CURSO_WORKSHOP deixa escolher entre os dois. */
  categoria: 'CERTIFICACAO' | 'CURSO_WORKSHOP'
  onCriar: (input: NovoCursoInput, arquivo?: File | null) => Promise<CursoQualificacao>
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function NewCursoModal({ children, categoria, onCriar }: NewCursoModalProps) {
  const [open, setOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [tipo, setTipo] = useState<TipoCursoQualificacao>(
    categoria === 'CERTIFICACAO' ? 'CERTIFICACAO' : 'CURSO',
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [arrastandoNaTela, setArrastandoNaTela] = useState(false)
  const [nome, setNome] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Campos obrigatórios pra cadastrar (nome e instituição) — os demais são
  // opcionais. Enquanto algum estiver vazio, o botão "Adicionar" fica
  // desabilitado.
  const podeEnviar = Boolean(nome.trim() && instituicao.trim())

  const titulo = categoria === 'CERTIFICACAO' ? 'Nova certificação' : 'Novo curso/workshop'
  const icone = categoria === 'CERTIFICACAO' ? Award : BookOpen
  const Icon = icone

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  // Com o dialog aberto, soltar um arquivo em qualquer ponto da tela conta
  // como upload do certificado — não precisa acertar a caixinha.
  useEffect(() => {
    if (!open) return

    function handleWindowDragOver(event: globalThis.DragEvent) {
      if (!event.dataTransfer?.types.includes('Files')) return
      event.preventDefault()
      setArrastandoNaTela(true)
    }

    function handleWindowDragLeave(event: globalThis.DragEvent) {
      // relatedTarget vazio = saiu da janela de verdade (não é só troca
      // de elemento interno, que também dispara dragleave).
      if (!event.relatedTarget) {
        setArrastandoNaTela(false)
      }
    }

    function handleWindowDrop(event: globalThis.DragEvent) {
      event.preventDefault()
      setArrastandoNaTela(false)
      const arquivo = event.dataTransfer?.files?.[0]
      if (arquivo) setSelectedFile(arquivo)
    }

    window.addEventListener('dragover', handleWindowDragOver)
    window.addEventListener('dragleave', handleWindowDragLeave)
    window.addEventListener('drop', handleWindowDrop)

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver)
      window.removeEventListener('dragleave', handleWindowDragLeave)
      window.removeEventListener('drop', handleWindowDrop)
    }
  }, [open])

  function limpar() {
    setSelectedFile(null)
    setTipo(categoria === 'CERTIFICACAO' ? 'CERTIFICACAO' : 'CURSO')
    setNome('')
    setInstituicao('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!podeEnviar) return

    const formData = new FormData(event.currentTarget)
    const cargaHorariaRaw = String(formData.get('cargaHoraria') ?? '').trim()
    const dataEmissao = String(formData.get('dataEmissao') ?? '').trim()
    const dataValidade = String(formData.get('dataValidade') ?? '').trim()

    setEnviando(true)
    try {
      await onCriar(
        {
          tipo,
          nome: nome.trim(),
          instituicao: instituicao.trim(),
          cargaHoraria: cargaHorariaRaw ? Number(cargaHorariaRaw) : null,
          dataEmissao: dataEmissao || null,
          dataValidade: dataValidade || null,
          certificadoUrl: null,
        },
        selectedFile,
      )
      setOpen(false)
      limpar()
      event.currentTarget.reset()
      toast({
        title: 'Registro enviado',
        description: 'Cadastrado como pendente — aguarda aprovação do RH.',
        duration: 4000,
      })
    } catch (error) {
      toast({
        title: 'Não foi possível cadastrar',
        description: error instanceof Error ? error.message : 'Tente novamente.',
        variant: 'destructive',
        duration: 5000,
      })
    } finally {
      setEnviando(false)
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null)
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
    <Dialog
      open={open}
      onOpenChange={(novoEstado) => {
        if (!novoEstado) limpar()
        setOpen(novoEstado)
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <Icon className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>{titulo}</DialogTitle>
              <DialogDescription>
                Entra como pendente até o RH aprovar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          {categoria === 'CURSO_WORKSHOP' && (
            <div className="grid gap-2">
              <Label htmlFor="curso-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoCursoQualificacao)}>
                <SelectTrigger id="curso-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CURSO">Curso</SelectItem>
                  <SelectItem value="WORKSHOP">Workshop</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="curso-nome">Nome</Label>
            <Input
              id="curso-nome"
              name="nome"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder={
                categoria === 'CERTIFICACAO'
                  ? 'Ex: AWS Certified Cloud Practitioner'
                  : 'Ex: Liderança de Equipes de Alta Performance'
              }
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="curso-instituicao">Instituição</Label>
            <Input
              id="curso-instituicao"
              name="instituicao"
              value={instituicao}
              onChange={(event) => setInstituicao(event.target.value)}
              placeholder="Ex: Amazon Web Services"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="curso-carga-horaria">Carga horária (h)</Label>
              <Input id="curso-carga-horaria" name="cargaHoraria" type="number" min={1} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="curso-data-emissao">Emissão</Label>
              <Input id="curso-data-emissao" name="dataEmissao" type="date" />
            </div>
          </div>

          {categoria === 'CERTIFICACAO' && (
            <div className="grid gap-2">
              <Label htmlFor="curso-data-validade">Validade (opcional)</Label>
              <Input id="curso-data-validade" name="dataValidade" type="date" />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="curso-certificado">Certificado (opcional)</Label>
            <Input
              ref={fileInputRef}
              id="curso-certificado"
              name="certificado"
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {!selectedFile && (
              <div
                role="button"
                tabIndex={0}
                className={`flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-3 text-center outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
                  arrastandoNaTela
                    ? 'border-ring bg-muted/40'
                    : 'border-muted-foreground/30 bg-background hover:bg-muted/30'
                }`}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
              >
                <Upload className="mb-1.5 h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {arrastandoNaTela
                    ? 'Solte o arquivo aqui'
                    : 'Arraste o certificado aqui ou clique para selecionar'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">PDF ou imagem</p>
              </div>
            )}

            {selectedFile && previewUrl ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background p-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {selectedFile.type.startsWith('image/') ? (
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileText className="h-4 w-4 text-muted-foreground" />
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
                    aria-label="Visualizar certificado"
                    onClick={handlePreviewFile}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Baixar certificado"
                    onClick={handleDownloadFile}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remover certificado"
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
            <Button type="submit" disabled={enviando || !podeEnviar}>
              {enviando ? 'Enviando…' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
