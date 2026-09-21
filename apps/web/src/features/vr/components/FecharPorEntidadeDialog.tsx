import { useEffect, useState } from 'react'
import { ChevronDown, Download, Eye, Lock, Unlock } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { vrService } from '@/features/vr/services'
import type {
  EntidadeOpcao,
  FormatoExportacaoVr,
  PreVisualizacaoResultado,
  StatusFechamentoEntidade,
  VrMes,
} from '@/features/vr/types'

interface FecharPorEntidadeDialogProps {
  vrMes: VrMes
  entidades: EntidadeOpcao[]
  /** Chamado depois de fechar uma entidade — recarrega a lista de meses. */
  onFechado: () => Promise<void>
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Iniciais (primeiro + último nome) para o avatar. */
function gerarIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

/**
 * Dialog "Fechar por entidade": escolhe a entidade (ACeAm, RADOAM, NT
 * Store...), vê se ela já está aberta ou fechada nesse mês, pré-visualiza,
 * fecha e baixa os arquivos — tudo isolado por entidade, sem afetar as
 * outras.
 */
export function FecharPorEntidadeDialog({
  vrMes,
  entidades,
  onFechado,
}: FecharPorEntidadeDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [carregandoStatus, setCarregandoStatus] = useState(false)
  const [status, setStatus] = useState<StatusFechamentoEntidade[]>([])
  const [entityIdSelecionado, setEntityIdSelecionado] = useState('')

  const [preview, setPreview] = useState<PreVisualizacaoResultado | null>(null)
  const [carregandoPreview, setCarregandoPreview] = useState(false)
  const [fechando, setFechando] = useState(false)
  const [baixando, setBaixando] = useState<FormatoExportacaoVr | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function carregarStatus() {
    setCarregandoStatus(true)
    try {
      const dados = await vrService.getStatusEntidades(vrMes.id)
      setStatus(dados)
      if (!entityIdSelecionado && dados.length > 0) {
        setEntityIdSelecionado(dados[0].entityId)
      }
    } catch (error) {
      console.error('Erro ao buscar status das entidades', error)
    } finally {
      setCarregandoStatus(false)
    }
  }

  useEffect(() => {
    if (aberto) carregarStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto])

  useEffect(() => {
    setPreview(null)
    setErro(null)
  }, [entityIdSelecionado])

  const statusAtual = status.find((s) => s.entityId === entityIdSelecionado)
  const nomeEntidadeAtual =
    statusAtual?.entityNome ?? entidades.find((e) => e.id === entityIdSelecionado)?.nome ?? ''

  async function handlePreVisualizar() {
    if (!entityIdSelecionado) return
    setErro(null)
    setCarregandoPreview(true)
    try {
      setPreview(await vrService.preVisualizar(vrMes.id, entityIdSelecionado))
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao pré-visualizar.')
    } finally {
      setCarregandoPreview(false)
    }
  }

  async function handleFechar() {
    if (!entityIdSelecionado) return
    const confirmado = window.confirm(
      `Fechar o VR de ${nomeEntidadeAtual}? Essa ação aplica os lançamentos pendentes dessa entidade e não pode ser desfeita.`,
    )
    if (!confirmado) return

    setErro(null)
    setFechando(true)
    try {
      await vrService.fecharEntidade(vrMes.id, entityIdSelecionado)
      await carregarStatus()
      await onFechado()
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao fechar a entidade.')
    } finally {
      setFechando(false)
    }
  }

  async function handleBaixar(formato: FormatoExportacaoVr) {
    if (!entityIdSelecionado) return
    setBaixando(formato)
    try {
      await vrService.baixar(vrMes, formato, entityIdSelecionado)
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao baixar o arquivo.')
    } finally {
      setBaixando(null)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5" disabled={vrMes.diasElegiveis === 0}>
          <Lock className="h-4 w-4" />
          Fechar por entidade
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Fechar por entidade — {vrMes.mes}/{vrMes.ano}
          </DialogTitle>
          <DialogDescription>
            Cada entidade fecha e baixa seus arquivos de forma independente das outras.
          </DialogDescription>
        </DialogHeader>

        {carregandoStatus ? (
          <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
        ) : status.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhuma entidade com colaborador ativo encontrada.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {status.map((s) => (
                <button
                  key={s.entityId}
                  type="button"
                  onClick={() => setEntityIdSelecionado(s.entityId)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    s.entityId === entityIdSelecionado
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'hover:bg-muted'
                  }`}
                >
                  {s.entityNome}
                  {s.fechado ? (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Unlock className="h-3 w-3 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>

            {statusAtual && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{statusAtual.entityNome}</p>
                  <Badge variant={statusAtual.fechado ? 'secondary' : 'outline'} className="mt-1 gap-1">
                    {statusAtual.fechado ? (
                      <>
                        <Lock className="h-3 w-3" /> Fechada
                      </>
                    ) : (
                      'Aberta'
                    )}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  {!statusAtual.fechado && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handlePreVisualizar}
                        disabled={carregandoPreview}
                        className="gap-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        {carregandoPreview ? 'Calculando...' : 'Pré-visualizar'}
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleFechar}
                        disabled={fechando}
                        className="gap-1.5"
                      >
                        <Lock className="h-4 w-4" />
                        {fechando ? 'Fechando...' : 'Fechar'}
                      </Button>
                    </>
                  )}

                  {statusAtual.fechado && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={baixando !== null}
                          className="gap-1.5"
                        >
                          <Download className="h-4 w-4" />
                          {baixando ? 'Baixando...' : 'Baixar'}
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleBaixar('pdf')}>PDF</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBaixar('csv')}>
                          CSV (operadora)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBaixar('xlsx')}>Excel</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            )}

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            {preview && (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Total Bruto</p>
                    <p className="font-semibold">{formatarMoeda(preview.totalBruto)}</p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Descontos</p>
                    <p className="font-semibold text-destructive">
                      -{formatarMoeda(preview.totalDescontos)}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Valor Final</p>
                    <p className="font-semibold text-emerald-600">
                      {formatarMoeda(preview.valorFinal)}
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Colaboradores</p>
                    <p className="font-semibold">{preview.colaboradores}</p>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto rounded-md border">
                  {preview.itens.map((item) => (
                    <div
                      key={item.userId}
                      className="flex items-center justify-between gap-3 border-b p-2.5 text-sm last:border-0"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                          {gerarIniciais(item.userNome)}
                        </div>
                        <span>{item.userNome}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">Dias: {item.diasVr}</span>
                        <span className="w-20 text-right font-semibold">
                          {formatarMoeda(item.valorAReceber)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
