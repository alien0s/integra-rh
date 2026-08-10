import { useState, type ReactNode } from 'react'

import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/hooks/use-toast'

/** Tipo de campo de uma coluna editável da tabela. */
export type RegistroColumnType = 'text' | 'number' | 'select'

export interface RegistroColumn<TDraft extends Record<string, string>> {
  /** Chave do campo no rascunho de edição da linha. */
  key: keyof TDraft & string
  label: string
  type: RegistroColumnType
  placeholder?: string
  required?: boolean
  /** Opções do <select>, quando type === 'select'. */
  options?: { value: string; label: string }[]
  /** Classe aplicada ao <th>/<td> (ex.: largura da coluna). */
  className?: string
}

interface RegistrosCardProps<
  TRow extends { id: string },
  TDraft extends Record<string, string>,
> {
  titulo: string
  descricao?: string
  colunas: RegistroColumn<TDraft>[]
  registros: TRow[]
  isLoading?: boolean
  error?: string | null
  /** Rascunho inicial para um novo registro. */
  rascunhoVazio: TDraft
  /** Converte um registro existente no rascunho de edição da linha. */
  paraRascunho: (registro: TRow) => TDraft
  /** Como exibir uma coluna em modo leitura (sobrescreve o valor cru). */
  exibir?: (registro: TRow, coluna: RegistroColumn<TDraft>) => ReactNode
  /** Rótulo do registro usado nas mensagens (ex.: "o departamento"). */
  rotuloRegistro: string
  /** Nome exibido na confirmação de exclusão (ex.: nome da linha). */
  nomeExibicao: (registro: TRow) => string
  /**
   * Texto extra anexado à confirmação de exclusão, para avisar de efeitos em
   * cascata (ex.: excluir uma entidade também apaga seus departamentos,
   * funções e usuários vinculados).
   */
  avisoExclusao?: string
  onCriar: (rascunho: TDraft) => Promise<unknown>
  onAtualizar: (id: string, rascunho: TDraft) => Promise<unknown>
  onExcluir: (id: string) => Promise<unknown>
}

const NOVO = '__novo__'

/**
 * Card com uma tabela de registros totalmente editável in-line: não há modal
 * ou dialog de edição — ao clicar em editar (ou em "Novo"), a própria linha
 * da tabela vira um formulário, com os botões de salvar/cancelar substituindo
 * as ações. Usado pela tela Tabelas para manter entidades, departamentos,
 * funções e papéis.
 */
export function RegistrosCard<
  TRow extends { id: string },
  TDraft extends Record<string, string>,
>({
  titulo,
  descricao,
  colunas,
  registros,
  isLoading = false,
  error = null,
  rascunhoVazio,
  paraRascunho,
  exibir,
  rotuloRegistro,
  nomeExibicao,
  avisoExclusao,
  onCriar,
  onAtualizar,
  onExcluir,
}: RegistrosCardProps<TRow, TDraft>) {
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [rascunho, setRascunho] = useState<TDraft | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erroLinha, setErroLinha] = useState<string | null>(null)
  const [excluindoId, setExcluindoId] = useState<string | null>(null)

  const emEdicao = editandoId !== null

  function iniciarNovo() {
    setEditandoId(NOVO)
    setRascunho({ ...rascunhoVazio })
    setErroLinha(null)
  }

  function iniciarEdicao(registro: TRow) {
    setEditandoId(registro.id)
    setRascunho(paraRascunho(registro))
    setErroLinha(null)
  }

  function cancelar() {
    setEditandoId(null)
    setRascunho(null)
    setErroLinha(null)
  }

  async function salvar() {
    if (!rascunho || !editandoId) return

    const faltando = colunas.filter(
      (coluna) => coluna.required && !rascunho[coluna.key]?.trim(),
    )
    if (faltando.length > 0) {
      setErroLinha(`Preencha: ${faltando.map((c) => c.label).join(', ')}.`)
      return
    }

    setSalvando(true)
    setErroLinha(null)
    try {
      if (editandoId === NOVO) {
        await onCriar(rascunho)
      } else {
        await onAtualizar(editandoId, rascunho)
      }
      cancelar()
    } catch (erro) {
      setErroLinha(erro instanceof Error ? erro.message : `Falha ao salvar ${rotuloRegistro}.`)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(registro: TRow) {
    const mensagem = [
      `Excluir ${rotuloRegistro} "${nomeExibicao(registro)}"? Essa ação não pode ser desfeita.`,
      avisoExclusao,
    ]
      .filter(Boolean)
      .join('\n\n')
    const confirmado = window.confirm(mensagem)
    if (!confirmado) return

    setExcluindoId(registro.id)
    try {
      await onExcluir(registro.id)
      toast({ title: `Registro excluído`, description: nomeExibicao(registro), duration: 3000 })
    } catch (erro) {
      toast({
        title: `Não foi possível excluir ${rotuloRegistro}`,
        description: erro instanceof Error ? erro.message : undefined,
        variant: 'destructive',
      })
    } finally {
      setExcluindoId(null)
    }
  }

  function renderCampo(coluna: RegistroColumn<TDraft>) {
    const valor = rascunho?.[coluna.key] ?? ''

    if (coluna.type === 'select') {
      return (
        <Select
          value={valor}
          onValueChange={(novoValor) =>
            setRascunho((atual) => (atual ? { ...atual, [coluna.key]: novoValor } : atual))
          }
        >
          <SelectTrigger className="h-8">
            <SelectValue placeholder={coluna.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {coluna.options?.map((opcao) => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }

    return (
      <Input
        className="h-8"
        type={coluna.type === 'number' ? 'number' : 'text'}
        value={valor}
        placeholder={coluna.placeholder}
        onChange={(event) => {
          const novoValor = event.target.value
          setRascunho((atual) => (atual ? { ...atual, [coluna.key]: novoValor } : atual))
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') salvar()
          if (event.key === 'Escape') cancelar()
        }}
      />
    )
  }

  function renderAcoesEdicao() {
    return (
      <div className="flex justify-end gap-1">
        <Button size="icon-sm" variant="ghost" onClick={salvar} disabled={salvando} aria-label="Salvar">
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={cancelar}
          disabled={salvando}
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  const colSpanTotal = colunas.length + 1

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{titulo}</CardTitle>
          {descricao ? <CardDescription>{descricao}</CardDescription> : null}
        </div>
        <Button size="sm" variant="outline" onClick={iniciarNovo} disabled={emEdicao}>
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {colunas.map((coluna) => (
                <TableHead key={coluna.key} className={coluna.className}>
                  {coluna.label}
                </TableHead>
              ))}
              <TableHead className="w-20 pr-6 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {editandoId === NOVO ? (
              <TableRow>
                {colunas.map((coluna) => (
                  <TableCell key={coluna.key}>{renderCampo(coluna)}</TableCell>
                ))}
                <TableCell className="pr-6">{renderAcoesEdicao()}</TableCell>
              </TableRow>
            ) : null}

            {isLoading ? (
              <TableRow>
                <TableCell colSpan={colSpanTotal} className="h-20 text-center text-sm text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={colSpanTotal} className="h-20 text-center text-sm text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : registros.length === 0 && editandoId !== NOVO ? (
              <TableRow>
                <TableCell
                  colSpan={colSpanTotal}
                  className="h-20 text-center text-sm text-muted-foreground"
                >
                  Nenhum registro cadastrado.
                </TableCell>
              </TableRow>
            ) : (
              registros.map((registro) =>
                editandoId === registro.id ? (
                  <TableRow key={registro.id}>
                    {colunas.map((coluna) => (
                      <TableCell key={coluna.key}>{renderCampo(coluna)}</TableCell>
                    ))}
                    <TableCell className="pr-6">{renderAcoesEdicao()}</TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={registro.id}>
                    {colunas.map((coluna) => (
                      <TableCell key={coluna.key} className="text-sm">
                        {exibir
                          ? exibir(registro, coluna)
                          : String((registro as unknown as Record<string, unknown>)[coluna.key] ?? '')}
                      </TableCell>
                    ))}
                    <TableCell className="pr-6 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-muted-foreground"
                          onClick={() => iniciarEdicao(registro)}
                          disabled={emEdicao}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          onClick={() => excluir(registro)}
                          disabled={emEdicao || excluindoId === registro.id}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
        {erroLinha ? (
          <p className="border-t bg-destructive/5 px-6 py-2 text-sm text-destructive">{erroLinha}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
