import { useEffect, useMemo, useState } from 'react'
import { ptBR } from 'date-fns/locale'
import { ClipboardList, Plus, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { vrService } from '@/features/vr/services'
import {
  MOTIVOS_LANCAMENTO_VR,
  type ColaboradorOpcao,
  type EntidadeOpcao,
  type ItemLancamentoVr,
  type LancamentoVr,
  type TipoLancamentoVr,
  type VrMes,
} from '@/features/vr/types'

interface LancamentosVrDialogProps {
  vrMes: VrMes
  colaboradores: ColaboradorOpcao[]
  entidades: EntidadeOpcao[]
}

/** "2026-11-21" a partir de um Date, sem deslocamento de fuso. */
function paraIsoLocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/** Gera uma chave só pra uso local (key do React) — evita crypto.randomUUID() (contexto seguro). */
function gerarChaveLocal(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/* ── Aba: lançamento individual ──────────────────────────────────────── */

interface LinhaIndividual {
  key: string
  data: string
  tipo: TipoLancamentoVr
  motivo: string
}

function novaLinha(): LinhaIndividual {
  return { key: gerarChaveLocal(), data: '', tipo: 'DESCONTO', motivo: '' }
}

function AbaIndividual({
  colaboradores,
  existentes,
  onLancar,
}: {
  colaboradores: ColaboradorOpcao[]
  existentes: LancamentoVr[]
  onLancar: (itens: ItemLancamentoVr[]) => Promise<void>
}) {
  const [userId, setUserId] = useState('')
  const [linhas, setLinhas] = useState<LinhaIndividual[]>([novaLinha()])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Datas que aparecem em mais de 1 linha (mesma pessoa, mesmo lançamento) —
  // usado pra destacar em vermelho e bloquear o envio.
  const datasDuplicadas = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const l of linhas) {
      if (!l.data) continue
      contagem.set(l.data, (contagem.get(l.data) ?? 0) + 1)
    }
    return new Set([...contagem.entries()].filter(([, qtd]) => qtd > 1).map(([data]) => data))
  }, [linhas])

  function atualizarLinha(key: string, patch: Partial<LinhaIndividual>) {
    setLinhas((atual) => atual.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  function removerLinha(key: string) {
    setLinhas((atual) => (atual.length > 1 ? atual.filter((l) => l.key !== key) : atual))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErro(null)

    const validas = linhas.filter((l) => l.data)
    if (!userId || validas.length === 0) {
      setErro('Escolha o colaborador e pelo menos 1 data.')
      return
    }

    if (validas.some((l) => !l.motivo)) {
      setErro('Escolha o motivo de cada linha.')
      return
    }

    if (datasDuplicadas.size > 0) {
      setErro('Tem data repetida entre as linhas — cada data só pode aparecer 1 vez.')
      return
    }

    const jaExiste = validas.some((l) =>
      existentes.some((e) => e.userId === userId && e.dataDesconto === l.data),
    )
    if (jaExiste) {
      setErro('Já existe um lançamento pra esse colaborador nessa data — cancele o antigo antes de lançar de novo.')
      return
    }

    const itens: ItemLancamentoVr[] = validas.map((l) => ({
      userId,
      tipoLancamento: l.tipo,
      dataDesconto: l.data,
      motivo: l.motivo.trim() || null,
    }))

    setEnviando(true)
    try {
      await onLancar(itens)
      setLinhas([novaLinha()])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao lançar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="lanc-ind-colaborador">Colaborador</Label>
        <select
          id="lanc-ind-colaborador"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        >
          <option value="">Selecione...</option>
          {colaboradores.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Datas</Label>
        {linhas.map((linha) => (
          <div key={linha.key} className="flex items-center gap-2">
            <Input
              type="date"
              className={`w-36 ${datasDuplicadas.has(linha.data) ? 'border-destructive' : ''}`}
              value={linha.data}
              onChange={(e) => atualizarLinha(linha.key, { data: e.target.value })}
            />
            <select
              className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm"
              value={linha.tipo}
              onChange={(e) =>
                atualizarLinha(linha.key, { tipo: e.target.value as TipoLancamentoVr })
              }
            >
              <option value="DESCONTO">Desconto</option>
              <option value="EXTRA">Extra</option>
            </select>
            <select
              className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
              value={linha.motivo}
              onChange={(e) => atualizarLinha(linha.key, { motivo: e.target.value })}
            >
              <option value="">Motivo</option>
              {MOTIVOS_LANCAMENTO_VR.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              onClick={() => removerLinha(linha.key)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-fit gap-1.5"
          onClick={() => setLinhas((atual) => [...atual, novaLinha()])}
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar data
        </Button>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button
        type="submit"
        disabled={enviando || datasDuplicadas.size > 0}
        className="w-fit gap-1.5"
      >
        <Plus className="h-4 w-4" />
        {enviando ? 'Lançando...' : 'Lançar'}
      </Button>
    </form>
  )
}

/* ── Aba: desconto em massa ──────────────────────────────────────────── */

function AbaEmMassa({
  colaboradores,
  existentes,
  onLancar,
}: {
  colaboradores: ColaboradorOpcao[]
  existentes: LancamentoVr[]
  onLancar: (itens: ItemLancamentoVr[]) => Promise<void>
}) {
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [tipo, setTipo] = useState<TipoLancamentoVr>('DESCONTO')
  const [motivo, setMotivo] = useState('')
  const [datas, setDatas] = useState<Date[]>([])
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const filtrados = useMemo(
    () => colaboradores.filter((u) => u.nome.toLowerCase().includes(busca.toLowerCase())),
    [colaboradores, busca],
  )

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErro(null)

    if (selecionados.size === 0 || datas.length === 0) {
      setErro('Selecione pelo menos 1 colaborador e 1 data.')
      return
    }

    if (!motivo) {
      setErro('Escolha o motivo.')
      return
    }

    const itens: ItemLancamentoVr[] = []
    for (const userId of selecionados) {
      for (const data of datas) {
        itens.push({
          userId,
          tipoLancamento: tipo,
          dataDesconto: paraIsoLocal(data),
          motivo: motivo.trim() || null,
        })
      }
    }

    const conflitos = itens.filter((item) =>
      existentes.some((e) => e.userId === item.userId && e.dataDesconto === item.dataDesconto),
    )
    if (conflitos.length > 0) {
      const nomes = [...new Set(conflitos.map((c) => c.userId))]
        .map((id) => colaboradores.find((u) => u.id === id)?.nome ?? id)
        .join(', ')
      setErro(
        `Já existe lançamento pra essas datas com: ${nomes}. Cancele o antigo antes de lançar de novo.`,
      )
      return
    }

    setEnviando(true)
    try {
      await onLancar(itens)
      setSelecionados(new Set())
      setMotivo('')
      setDatas([])
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha ao lançar em massa.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Colaboradores ({selecionados.size} selecionado(s))</Label>
          <Input placeholder="Pesquisar nome..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <div className="h-48 overflow-y-auto rounded-md border">
            {filtrados.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2 border-b px-2 py-1.5 text-sm last:border-0 hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={selecionados.has(u.id)}
                  onChange={() => alternar(u.id)}
                />
                {u.nome}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="massa-tipo">Tipo</Label>
            <select
              id="massa-tipo"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoLancamentoVr)}
            >
              <option value="DESCONTO">Desconto</option>
              <option value="EXTRA">Extra</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="massa-motivo">Motivo (1 só, aplicado a todos)</Label>
            <select
              id="massa-motivo"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              <option value="">Selecione o motivo...</option>
              {MOTIVOS_LANCAMENTO_VR.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Datas ({datas.length} marcada(s))</Label>
        <div className="flex justify-center rounded-md border">
          <Calendar mode="multiple" locale={ptBR} selected={datas} onSelect={(d) => setDatas(d ?? [])} />
        </div>
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Button type="submit" disabled={enviando || !motivo} className="w-fit gap-1.5">
        <Plus className="h-4 w-4" />
        {enviando ? 'Lançando...' : `Lançar para ${selecionados.size} pessoa(s)`}
      </Button>
    </form>
  )
}

/* ── Dialog principal ─────────────────────────────────────────────────── */

/**
 * Dialog "Lançamentos": lista os descontos/extras já lançados no mês (com
 * opção de cancelar os que ainda não foram aplicados) e 2 formas de lançar
 * um novo — individual ou em massa. Tem um filtro de entidade no topo, pra
 * facilitar achar só os colaboradores da entidade que a auxiliar cuida.
 */
export function LancamentosVrDialog({ vrMes, colaboradores, entidades }: LancamentosVrDialogProps) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [lancamentos, setLancamentos] = useState<LancamentoVr[]>([])
  const [entityIdFiltro, setEntityIdFiltro] = useState('')

  async function carregar() {
    setCarregando(true)
    try {
      setLancamentos(await vrService.getLancamentos(vrMes.id, entityIdFiltro || undefined))
    } catch (error) {
      console.error('Erro ao buscar lançamentos de VR', error)
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    if (aberto) carregar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, entityIdFiltro])

  // Cada mês é de um grupo (campo): só aparecem colaboradores/entidades dele.
  const colaboradoresDoGrupo = useMemo(
    () => colaboradores.filter((c) => c.entityGrupo === vrMes.grupo),
    [colaboradores, vrMes.grupo],
  )
  const entidadesDoGrupo = useMemo(
    () => entidades.filter((e) => e.grupo === vrMes.grupo),
    [entidades, vrMes.grupo],
  )

  const colaboradoresFiltrados = useMemo(
    () =>
      entityIdFiltro
        ? colaboradoresDoGrupo.filter((c) => c.entityId === entityIdFiltro)
        : colaboradoresDoGrupo,
    [colaboradoresDoGrupo, entityIdFiltro],
  )

  async function handleLancarLote(itens: ItemLancamentoVr[]) {
    await vrService.criarLancamentosEmLote(vrMes.id, itens)
    await carregar()
  }

  async function handleCancelar(id: string) {
    await vrService.cancelarLancamento(id)
    setLancamentos((atual) => atual.filter((l) => l.id !== id))
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ClipboardList className="h-4 w-4" />
          Lançamentos
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Lançamentos de VR — {vrMes.mes}/{vrMes.ano}
          </DialogTitle>
          <DialogDescription>
            Descontos e extras aplicados no fechamento deste mês.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="lanc-filtro-entidade" className="shrink-0">
              Entidade
            </Label>
            <select
              id="lanc-filtro-entidade"
              className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              value={entityIdFiltro}
              onChange={(e) => setEntityIdFiltro(e.target.value)}
            >
              <option value="">Todas as entidades</option>
              {entidadesDoGrupo.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="max-h-48 overflow-y-auto rounded-md border">
            {carregando ? (
              <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
            ) : lancamentos.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                Nenhum lançamento encontrado.
              </p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {lancamentos.map((l) => (
                    <tr key={l.id} className="border-b last:border-0">
                      <td className="p-2">{l.userNome}</td>
                      <td className="p-2">
                        <Badge variant={l.tipoLancamento === 'DESCONTO' ? 'destructive' : 'secondary'}>
                          {l.tipoLancamento === 'DESCONTO' ? 'Desconto' : 'Extra'}
                        </Badge>
                      </td>
                      <td className="p-2">{formatarDataBr(l.dataDesconto)}</td>
                      <td className="p-2 text-muted-foreground">{l.motivo ?? '—'}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {l.criadoPorNome ? `por ${l.criadoPorNome}` : '—'}
                      </td>
                      <td className="p-2">
                        {l.descontoAplicado ? (
                          <Badge variant="outline">Aplicado</Badge>
                        ) : (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleCancelar(l.id)}
                            title="Cancelar lançamento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <Tabs defaultValue="individual">
            <TabsList className="h-9">
              <TabsTrigger value="individual" className="px-5">
                Individual
              </TabsTrigger>
              <TabsTrigger value="massa" className="px-5">
                Desconto em massa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="individual" className="pt-3">
              <AbaIndividual
                colaboradores={colaboradoresFiltrados}
                existentes={lancamentos}
                onLancar={handleLancarLote}
              />
            </TabsContent>
            <TabsContent value="massa" className="pt-3">
              <AbaEmMassa
                colaboradores={colaboradoresFiltrados}
                existentes={lancamentos}
                onLancar={handleLancarLote}
              />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
