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
import type { FuncionarioCursoSuperior } from '@/features/cursos/types'
import { CURSOS_STYLES } from '@/lib/cursos'
import { FormacaoAcademica } from './FormacaoAcademica'
import { Idiomas } from './Idiomas'

interface FuncionariosCursosSuperioresTableProps {
  data: FuncionarioCursoSuperior[]
}

interface CursoIconItem {
  nome: string
  tipo: 'superior' | 'andamento' | 'rapido'
}

const idiomasFuncionario = [
  { id: '1', idioma: 'Inglês', nivel: 'Avançado (C1)', progresso: 85 },
  { id: '2', idioma: 'Espanhol', nivel: 'Intermediário (B2)', progresso: 50 },
  { id: '3', idioma: 'Francês', nivel: 'Básico (A2)', progresso: 25 },
]

function CursosSquares({ cursos }: { cursos: CursoIconItem[] }) {
  if (cursos.length === 0) {
    return <span className="text-sm text-muted-foreground">Sem registro</span>
  }

  const courseLabel = cursos.length === 1 ? 'curso' : 'cursos'

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${cursos.length} ${courseLabel}`}
    >
      {cursos.map((curso, index) => {
        let style = CURSOS_STYLES.FORMADOS
        if (curso.tipo === 'andamento') style = CURSOS_STYLES.EM_FORMACAO
        else if (curso.tipo === 'rapido') style = CURSOS_STYLES.CURSOS_RAPIDOS

        const Icon = style.icon

        return (
          <div
            key={`${curso.nome}-${index}`}
            title={curso.nome}
            className={`flex h-7 w-7 items-center justify-center rounded-md ${style.bgClass}`}
          >
            <Icon className={`h-4 w-4 ${style.textClass}`} />
          </div>
        )
      })}
    </div>
  )
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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
        [
          funcionario.nome,
          funcionario.cargo,
          funcionario.departamento,
          ...(funcionario.cursosSuperiores || []),
          ...(funcionario.emAndamento || []),
          ...(funcionario.cursosRapidos || []),
        ].join(' ')
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
              funcionarios.map((funcionario) => {
                const cursos = [
                  ...(funcionario.cursosSuperiores || []).map((nome) => ({
                    nome,
                    tipo: 'superior' as const,
                  })),
                  ...(funcionario.emAndamento || []).map((nome) => ({
                    nome,
                    tipo: 'andamento' as const,
                  })),
                  ...(funcionario.cursosRapidos || []).map((nome) => ({
                    nome,
                    tipo: 'rapido' as const,
                  })),
                ]

                return (
                  <Fragment key={funcionario.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() =>
                        setExpandedRow(
                          expandedRow === funcionario.id ? null : funcionario.id
                        )
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
                            <span className="font-medium leading-none">
                              {funcionario.nome}
                            </span>
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
                        <CursosSquares cursos={cursos} />
                      </TableCell>
                      <TableCell className="pr-6 text-right font-medium">
                        {cursos.length}
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
                              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <FormacaoAcademica
                                  hideAddButton
                                  data={[
                                    ...(funcionario.cursosSuperiores || []).map(
                                      (curso, i) => ({
                                        id: `sup-${i}`,
                                        curso,
                                        instituicao: 'Não informada',
                                        periodo: 'Não informado',
                                        status: 'CONCLUÍDO' as const,
                                      })
                                    ),
                                    ...(funcionario.emAndamento || []).map(
                                      (curso, i) => ({
                                        id: `and-${i}`,
                                        curso,
                                        instituicao: 'Não informada',
                                        periodo: 'Não informado',
                                        status: 'EM ANDAMENTO' as const,
                                      })
                                    ),
                                  ]}
                                />
                                <Idiomas data={idiomasFuncionario} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                )
              })
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
