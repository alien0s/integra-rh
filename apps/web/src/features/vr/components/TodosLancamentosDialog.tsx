import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Download } from 'lucide-react'

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
import { Input } from '@/components/ui/input'

import { vrService } from '@/features/vr/services'
import type { LancamentoVrDetalhado } from '@/features/vr/types'

const MESES_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

type FiltroStatus = 'TODOS' | 'APLICADO' | 'PENDENTE'
type FiltroTipo = 'TODOS' | 'DESCONTO' | 'EXTRA'

function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * Dialog "Todos os lançamentos": visão geral de descontos/extras de
 * TODOS os meses de uma vez, com filtros por mês/ano, tipo e status
 * (aplicado ou pendente) — e um botão de baixar PDF que respeita
 * exatamente esses filtros (o PDF só traz o que está sendo visualizado
 * na tela no momento em que ele é gerado).
 */
export function TodosLancamentosDialog({ mostrarGrupo = false }: { mostrarGrupo?: boolean }) {
  const [aberto, setAberto] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [baixandoPdf, setBaixandoPdf] = useState(false)
  const [lancamentos, setLancamentos] = useState<LancamentoVrDetalhado[]>([])

  const [busca, setBusca] = useState('')
  const [mesAno, setMesAno] = useState('TODOS')
  const [tipo, setTipo] = useState<FiltroTipo>('TODOS')
  const [status, setStatus] = useState<FiltroStatus>('TODOS')

  useEffect(() => {
    if (!aberto) return
    setCarregando(true)
    vrService
      .getTodosLancamentos()
      .then(setLancamentos)
      .catch((error) => console.error('Erro ao buscar todos os lançamentos de VR', error))
      .finally(() => setCarregando(false))
  }, [aberto])

  const opcoesMesAno = useMemo(() => {
    const combos = new Map<string, string>()
    for (const l of lancamentos) {
      const chave = `${l.mes}-${l.ano}`
      combos.set(chave, `${MESES_LABEL[l.mes - 1]}/${l.ano}`)
    }
    return Array.from(combos.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [lancamentos])

  const filtrados = useMemo(() => {
    return lancamentos.filter((l) => {
      if (mesAno !== 'TODOS' && `${l.mes}-${l.ano}` !== mesAno) return false
      if (tipo !== 'TODOS' && l.tipoLancamento !== tipo) return false
      if (status === 'APLICADO' && !l.descontoAplicado) return false
      if (status === 'PENDENTE' && l.descontoAplicado) return false
      if (busca && !l.userNome.toLowerCase().includes(busca.toLowerCase())) return false
      return true
    })
  }, [lancamentos, mesAno, tipo, status, busca])

  async function handleBaixarPdf() {
    setBaixandoPdf(true)
    try {
      const [mes, ano] = mesAno !== 'TODOS' ? mesAno.split('-').map(Number) : [undefined, undefined]
      await vrService.exportarTodosLancamentosPdf({
        busca: busca || undefined,
        mes,
        ano,
        tipo: tipo !== 'TODOS' ? tipo : undefined,
        status: status !== 'TODOS' ? status : undefined,
      })
    } catch (error) {
      console.error('Erro ao baixar o PDF dos lançamentos', error)
    } finally {
      setBaixandoPdf(false)
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <ClipboardList className="h-4 w-4" />
          Todos os lançamentos
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Todos os lançamentos de VR</DialogTitle>
          <DialogDescription>
            Descontos e extras de todos os meses, aplicados ou pendentes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Pesquisar nome..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-48"
            />
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={mesAno}
              onChange={(e) => setMesAno(e.target.value)}
            >
              <option value="TODOS">Todos os meses</option>
              {opcoesMesAno.map(([chave, label]) => (
                <option key={chave} value={chave}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as FiltroTipo)}
            >
              <option value="TODOS">Todos os tipos</option>
              <option value="DESCONTO">Desconto</option>
              <option value="EXTRA">Extra</option>
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as FiltroStatus)}
            >
              <option value="TODOS">Aplicado e pendente</option>
              <option value="APLICADO">Só aplicados</option>
              <option value="PENDENTE">Só pendentes</option>
            </select>
          </div>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={handleBaixarPdf}
            disabled={baixandoPdf || filtrados.length === 0}
            title="Baixa em PDF exatamente o que está sendo mostrado com os filtros atuais"
          >
            <Download className="h-4 w-4" />
            {baixandoPdf ? 'Baixando...' : 'Baixar PDF'}
          </Button>
        </div>

        <div className="max-h-[28rem] overflow-y-auto rounded-md border">
          {carregando ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2 font-medium">Data</th>
                  <th className="p-2 font-medium">Colaborador</th>
                  <th className="p-2 font-medium">Mês ref.</th>
                  <th className="p-2 font-medium">Tipo</th>
                  <th className="p-2 font-medium">Motivo</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Lançado por</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="p-2">{formatarDataBr(l.dataDesconto)}</td>
                    <td className="p-2">{l.userNome}</td>
                    <td className="p-2 text-muted-foreground">
                      {MESES_LABEL[l.mes - 1]}/{l.ano}
                      {mostrarGrupo && <span className="ml-1 text-xs">· {l.grupo}</span>}
                    </td>
                    <td className="p-2">
                      <Badge variant={l.tipoLancamento === 'DESCONTO' ? 'destructive' : 'secondary'}>
                        {l.tipoLancamento === 'DESCONTO' ? 'Desconto' : 'Extra'}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{l.motivo ?? '—'}</td>
                    <td className="p-2">
                      {l.descontoAplicado ? (
                        <Badge variant="outline">Aplicado</Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {l.criadoPorNome ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
