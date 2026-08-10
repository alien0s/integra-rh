import { useRef, useState, type DragEvent } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Link2,
  Loader2,
  UploadCloud,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { usuariosService, type ResultadoImportacao } from '@/features/usuarios/services'

interface ImportarUsuariosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Chamado após uma importação bem-sucedida (para recarregar a lista). */
  onImported?: () => void
}

/**
 * Modal de importação de usuários: área de arrastar-e-soltar (ou clicar) para
 * CSV/Excel e, alternativamente, importação a partir de uma URL. Mostra um
 * resumo (criados/ignorados/erros) ao final.
 */
export function ImportarUsuariosDialog({
  open,
  onOpenChange,
  onImported,
}: ImportarUsuariosDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [arrastando, setArrastando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null)

  function resetar() {
    setUrl('')
    setArrastando(false)
    setImportando(false)
    setErro(null)
    setResultado(null)
  }

  async function importar(payload: { file?: File; url?: string }) {
    setImportando(true)
    setErro(null)
    setResultado(null)
    try {
      const res = await usuariosService.importarUsuarios(payload)
      setResultado(res)
      if (res.criados > 0 || res.atualizados > 0) onImported?.()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao importar.')
    } finally {
      setImportando(false)
    }
  }

  function handleArquivo(file: File | undefined) {
    if (!file || importando) return
    importar({ file })
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    setArrastando(false)
    handleArquivo(event.dataTransfer.files?.[0])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(aberto) => {
        if (importando) return
        if (!aberto) resetar()
        onOpenChange(aberto)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar usuários</DialogTitle>
          <DialogDescription>
            Lê e-mail, nome, entidade e departamento de uma planilha e cria os
            usuários novos.
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <ResumoImportacao resultado={resultado} />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Área de upload (clicar ou arrastar). */}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setArrastando(true)
              }}
              onDragLeave={() => setArrastando(false)}
              onDrop={handleDrop}
              disabled={importando}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
                arrastando
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/40',
              )}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full border">
                {importando ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <UploadCloud className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {importando
                    ? 'Importando…'
                    : 'Selecione um arquivo para importar'}
                </p>
                <p className="text-xs text-muted-foreground">
                  ou arraste e solte aqui · CSV, Excel (.xlsx, .xls)
                </p>
              </div>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                handleArquivo(e.target.files?.[0])
                e.target.value = ''
              }}
            />

            {/* Importar de uma URL. */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Ou importe de uma URL</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://exemplo.com/usuarios.csv"
                    className="pl-8"
                    disabled={importando}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={importando || !url.trim()}
                  onClick={() => importar({ url: url.trim() })}
                >
                  Importar
                </Button>
              </div>
            </div>

            {erro ? (
              <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span>{erro}</span>
              </div>
            ) : null}
          </div>
        )}

        {resultado ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={resetar}>
              Importar outra
            </Button>
            <Button
              onClick={() => {
                resetar()
                onOpenChange(false)
              }}
            >
              Concluir
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Resumo pós-importação: contagens + lista de erros por linha. */
function ResumoImportacao({ resultado }: { resultado: ResultadoImportacao }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4">
        <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            {resultado.criados} criado(s) · {resultado.atualizados} atualizado(s)
          </p>
          <p className="text-muted-foreground">
            {resultado.ignorados} sem mudança · {resultado.erros.length} com erro
            {' '}· {resultado.total} linha(s) no total
          </p>
        </div>
      </div>

      {resultado.erros.length > 0 ? (
        <div className="max-h-48 overflow-y-auto rounded-lg border">
          <ul className="divide-y text-sm">
            {resultado.erros.map((erro, i) => (
              <li key={i} className="flex gap-2 px-3 py-2">
                <span className="shrink-0 font-medium text-muted-foreground">
                  Linha {erro.linha}
                </span>
                <span className="min-w-0 flex-1">
                  {erro.email ? (
                    <span className="text-muted-foreground">{erro.email} — </span>
                  ) : null}
                  {erro.motivo}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
