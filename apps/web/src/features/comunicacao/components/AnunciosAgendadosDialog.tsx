import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarClock, FileText, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { abrirArquivo } from '@/features/visualizador-arquivo'
import { cn } from '@/lib/utils'

import { comunicacaoService } from '../services'
import type { Comunicado } from '../types'

/** Anexo já baixado — blob reaproveitado pro thumb (imagem) e pro visualizador. */
interface AnexoCarregado {
  blob: Blob
  url: string
}

/** Formata "2026-09-15" (ou com timestamp) pra "15/09/2026". */
function formatarData(dataIso: string): string {
  return new Date(dataIso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

interface AnunciosAgendadosDialogProps {
  /** Chamado depois de cancelar um agendado. */
  onRemovido?: () => void
  /** Classe extra no botão-gatilho (ex.: `flex-1` na linha mobile da Home). */
  className?: string
}

/** Dialog com comunicados já aprovados, mas que ainda não chegaram na data_inicio. */
export function AnunciosAgendadosDialog({ onRemovido, className }: AnunciosAgendadosDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [agendados, setAgendados] = useState<Comunicado[]>([])
  const [carregando, setCarregando] = useState(true)
  const [removendo, setRemovendo] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // Anexos já baixados (por id do comunicado) — thumb de imagem carrega sozinho
  // ao abrir o dialog; PDF só baixa quando clicado (ver handleVerAnexo).
  const [anexos, setAnexos] = useState<Record<number, AnexoCarregado>>({})
  const anexosRef = useRef(anexos)
  anexosRef.current = anexos

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      setAgendados(await comunicacaoService.listarAgendados())
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao buscar os anúncios agendados.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (aberto) carregar()
  }, [aberto, carregar])

  // Pré-carrega o thumb só dos anexos de IMAGEM (PDF não tem preview visual,
  // só ícone — baixa sob demanda no clique). Pula quem já está em cache, pra
  // reabrir o dialog não refazer os mesmos downloads.
  useEffect(() => {
    const pendentes = agendados.filter(
      (c) => c.anexoTipo === 'IMAGEM' && !anexosRef.current[c.id],
    )
    if (pendentes.length === 0) return

    let cancelado = false
    Promise.all(
      pendentes.map(async (c) => {
        const blob = await comunicacaoService.baixarAnexo(c.id)
        return [c.id, { blob, url: URL.createObjectURL(blob) }] as const
      }),
    )
      .then((carregados) => {
        if (cancelado) return
        setAnexos((atual) => ({ ...atual, ...Object.fromEntries(carregados) }))
      })
      .catch((error) => {
        console.error('Erro ao pré-carregar miniatura de anexo', error)
      })

    return () => {
      cancelado = true
    }
  }, [agendados])

  // Revoga as object URLs só quando o componente desmonta de vez (o cache
  // acima já evita recriar URL pra quem reabre o dialog).
  useEffect(() => {
    return () => {
      Object.values(anexosRef.current).forEach(({ url }) => URL.revokeObjectURL(url))
    }
  }, [])

  /** Abre o anexo no visualizador universal — reaproveita o blob já em cache. */
  async function handleVerAnexo(comunicado: Comunicado) {
    const emCache = anexos[comunicado.id]
    if (emCache) {
      abrirArquivo({ blob: emCache.blob, titulo: comunicado.titulo })
      return
    }
    try {
      const blob = await comunicacaoService.baixarAnexo(comunicado.id)
      setAnexos((atual) => ({ ...atual, [comunicado.id]: { blob, url: URL.createObjectURL(blob) } }))
      abrirArquivo({ blob, titulo: comunicado.titulo })
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao abrir o anexo.')
    }
  }

  async function handleCancelar(comunicado: Comunicado) {
    setRemovendo(comunicado.id)
    try {
      await comunicacaoService.remover(comunicado.id)
      setAgendados((atual) => atual.filter((c) => c.id !== comunicado.id))
      onRemovido?.()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao cancelar o agendamento.')
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={cn(className)}>
          <CalendarClock className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Anúncios agendados</span>
          <span className="sm:hidden">Agendados</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Anúncios agendados</DialogTitle>
          <DialogDescription>
            Já aprovados, mas ainda aguardando a data de início chegar.
          </DialogDescription>
        </DialogHeader>

        {erro && <p className="text-sm text-destructive">{erro}</p>}

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {carregando ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : agendados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum anúncio agendado no momento.</p>
          ) : (
            agendados.map((comunicado) => (
              <div
                key={comunicado.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {comunicado.anexoTipo && (
                    <button
                      type="button"
                      onClick={() => handleVerAnexo(comunicado)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted"
                      title="Ver anexo"
                    >
                      {comunicado.anexoTipo === 'IMAGEM' && anexos[comunicado.id] ? (
                        <img
                          src={anexos[comunicado.id].url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  )}
                  <div className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-medium leading-none">
                      {comunicado.titulo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Começa em {formatarData(comunicado.dataInicio!)} · até{' '}
                      {formatarData(comunicado.dataFim!)}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={removendo === comunicado.id}
                  onClick={() => handleCancelar(comunicado)}
                  title="Cancelar agendamento"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
