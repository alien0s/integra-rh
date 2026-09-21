import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { NIVEL_FORMACAO_LABEL } from '@/lib/cursos'
import type { FormacaoAcademica, NivelFormacao, NovaFormacaoInput } from '../types'

interface NewGraduacaoModalProps {
  children: ReactNode
  onCriar: (input: NovaFormacaoInput, arquivo?: File | null) => Promise<FormacaoAcademica>
}

const currentYear = new Date().getFullYear()
const NIVEIS = Object.keys(NIVEL_FORMACAO_LABEL) as NivelFormacao[]

/** Rótulo abreviado — só pras abas de nível, pra caber tudo numa linha só. */
const NIVEL_LABEL_ABREVIADO: Record<NivelFormacao, string> = {
  TECNICO: 'Técn.',
  GRADUACAO: 'Grad.',
  POS_GRADUACAO: 'Pós-grad.',
  MBA: 'MBA',
  MESTRADO: 'Mestr.',
  DOUTORADO: 'Dout.',
}

function getYearOptions() {
  return Array.from({ length: 60 }, (_, index) => currentYear - index)
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function NewGraduacaoModal({ children, onCriar }: NewGraduacaoModalProps) {
  const [open, setOpen] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [arrastandoNaTela, setArrastandoNaTela] = useState(false)
  const [nivel, setNivel] = useState<NivelFormacao | ''>('')
  const [curso, setCurso] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [anoEntrada, setAnoEntrada] = useState('')
  const [anoSaida, setAnoSaida] = useState('')
  // Campos obrigatórios pra cadastrar (curso, instituição e os dois anos) —
  // nível tem checagem própria no submit. Enquanto algum estiver vazio, o
  // botão "Adicionar formação" fica desabilitado.
  const podeEnviar = Boolean(curso.trim() && instituicao.trim() && anoEntrada && anoSaida)
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

  // Com o dialog aberto, soltar um arquivo em qualquer ponto da tela conta
  // como upload do diploma — não precisa acertar a caixinha.
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
    setNivel('')
    setCurso('')
    setInstituicao('')
    setAnoEntrada('')
    setAnoSaida('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nivel || !podeEnviar) return

    setEnviando(true)
    try {
      await onCriar(
        {
          nivel,
          curso: curso.trim(),
          instituicao: instituicao.trim(),
          anoInicio: Number(anoEntrada),
          anoFim: anoSaida === 'presente' ? null : Number(anoSaida),
          situacao: anoSaida === 'presente' ? 'EM_ANDAMENTO' : 'CONCLUIDO',
          anexoUrl: null,
        },
        selectedFile,
      )
      setOpen(false)
      limpar()
      toast({
        title: 'Formação enviada',
        description: 'Cadastrada como pendente — aguarda aprovação do RH.',
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
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle>Nova formação acadêmica</DialogTitle>
              <DialogDescription>
                Adicione as informações do curso. Entra como pendente até o RH aprovar.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="graduacao-nivel">Nível</Label>
            <Tabs value={nivel} onValueChange={(v) => setNivel(v as NivelFormacao)}>
              <TabsList id="graduacao-nivel" className="flex h-auto w-full gap-1">
                {NIVEIS.map((item) => (
                  <TabsTrigger
                    key={item}
                    value={item}
                    className="px-1.5 py-1.5 text-sm"
                  >
                    {NIVEL_LABEL_ABREVIADO[item]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="graduacao-curso">Curso</Label>
            <Input
              id="graduacao-curso"
              name="curso"
              value={curso}
              onChange={(event) => setCurso(event.target.value)}
              placeholder="Ex: Administração de Empresas"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="graduacao-instituicao">Instituição</Label>
            <Input
              id="graduacao-instituicao"
              name="instituicao"
              value={instituicao}
              onChange={(event) => setInstituicao(event.target.value)}
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
                    : 'Arraste o diploma aqui ou clique para selecionar'}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">PDF ou imagem</p>
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
            <Button type="submit" disabled={enviando || !podeEnviar}>
              {enviando ? 'Enviando…' : 'Adicionar formação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
