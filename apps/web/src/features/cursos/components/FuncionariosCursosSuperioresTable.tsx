import { Fragment, useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useQualificacoesDeUsuario } from '@/features/cursos/hooks'
import type { FuncionarioQualificacoes } from '@/features/cursos/types'
import { CURSOS_STYLES } from '@/lib/cursos'
import { Certificacoes } from './Certificacoes'
import { CursosWorkshops } from './CursosWorkshops'
import { FormacaoAcademica } from './FormacaoAcademica'
import { Idiomas } from './Idiomas'

interface FuncionariosCursosSuperioresTableProps {
  data: FuncionarioQualificacoes[]
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Ícones de resumo (formações / cursos+workshops / certificações) com contagem. */
function ContagemQualificacoes({ funcionario }: { funcionario: FuncionarioQualificacoes }) {
  if (funcionario.total === 0) {
    return <span className="text-sm text-muted-foreground">Sem registro</span>
  }

  const grupos = [
    { estilo: CURSOS_STYLES.FORMADOS, qtd: funcionario.qtdFormacoes, label: 'formações' },
    { estilo: CURSOS_STYLES.EM_FORMACAO, qtd: funcionario.qtdCursosWorkshops, label: 'cursos/workshops' },
    { estilo: CURSOS_STYLES.CURSOS_RAPIDOS, qtd: funcionario.qtdCertificacoes, label: 'certificações' },
  ].filter((grupo) => grupo.qtd > 0)

  return (
    <div className="flex items-center gap-2">
      {grupos.map((grupo) => {
        const Icon = grupo.estilo.icon
        return (
          <div
            key={grupo.label}
            title={`${grupo.qtd} ${grupo.label}`}
            className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${grupo.estilo.bgClass}`}
          >
            <Icon className={`h-3.5 w-3.5 ${grupo.estilo.textClass}`} />
            <span className={`text-xs font-medium ${grupo.estilo.textClass}`}>{grupo.qtd}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Conteúdo da linha expandida: busca sob demanda as qualificações aprovadas do colaborador. */
function DetalheFuncionario({ usuarioId }: { usuarioId: string }) {
  const { data, isLoading } = useQualificacoesDeUsuario(usuarioId)

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>
  }

  const certificacoes = data.cursos.filter((item) => item.tipo === 'CERTIFICACAO')
  const cursosWorkshops = data.cursos.filter((item) => item.tipo !== 'CERTIFICACAO')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <FormacaoAcademica data={data.formacoes} hideAddButton />
        <Certificacoes data={certificacoes} hideAddButton />
        <CursosWorkshops data={cursosWorkshops} hideAddButton />
      </div>
      <Idiomas data={data.idiomas} hideAddButton />
    </div>
  )
}

export function FuncionariosCursosSuperioresTable({
  data,
}: FuncionariosCursosSuperioresTableProps) {
  const [search, setSearch] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const searchTerm = normalizeSearchValue(search.trim())
  const shouldSearch = searchTerm.length >= 3
  const funcionarios = useMemo(() => {
    if (!shouldSearch) {
      return data
    }

    return data.filter((funcionario) => {
      const searchableContent = normalizeSearchValue(
        [funcionario.nome, funcionario.cargo, funcionario.departamento].join(' '),
      )

      return searchableContent.includes(searchTerm)
    })
  }, [data, searchTerm, shouldSearch])

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Funcionários</CardTitle>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar"
            className="w-full bg-white pl-8 shadow-none"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 px-6">Nome</TableHead>
              <TableHead className="h-11">Departamento</TableHead>
              <TableHead className="h-11">Cursos</TableHead>
              <TableHead className="h-11 w-24 pr-6 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funcionarios.length > 0 ? (
              funcionarios.map((funcionario) => (
                <Fragment key={funcionario.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      setExpandedRow(expandedRow === funcionario.id ? null : funcionario.id)
                    }
                  >
                    <TableCell className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 rounded-lg">
                          <AvatarImage
                            src={funcionario.fotoUrl}
                            alt={funcionario.nome}
                            className="rounded-lg"
                          />
                          <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                            {funcionario.iniciais}
                          </AvatarFallback>
                        </Avatar>
                        <div className="grid gap-0.5">
                          <span className="font-medium leading-none">{funcionario.nome}</span>
                          <span className="text-xs text-muted-foreground">
                            {funcionario.cargo}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {funcionario.departamento}
                    </TableCell>
                    <TableCell>
                      <ContagemQualificacoes funcionario={funcionario} />
                    </TableCell>
                    <TableCell className="pr-6 text-right font-medium">
                      {funcionario.total}
                    </TableCell>
                  </TableRow>
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={4} className="p-0">
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          expandedRow === funcionario.id
                            ? 'grid-rows-[1fr] opacity-100'
                            : 'grid-rows-[0fr] opacity-0'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="bg-muted/20 p-6 shadow-inner">
                            {expandedRow === funcionario.id && (
                              <DetalheFuncionario usuarioId={funcionario.id} />
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Nenhum funcionário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
