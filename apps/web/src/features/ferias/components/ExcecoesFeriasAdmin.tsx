import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useExcecoesFerias } from '@/features/ferias/hooks'

/**
 * Tabela de exceções de férias (dentro de ExcecoesFeriasDialog, DP/COORDENADOR
 * DP/ADMIN): libera, por colaborador, as duas exceções — fracionar em até 2
 * períodos de 10 a 15 dias, e/ou vender até 10 dias (abono pecuniário).
 * Nenhuma das duas é padrão; o colaborador continua com o fluxo normal (1
 * período de até 30 dias) até que o DP marque aqui.
 */
export function ExcecoesFeriasAdmin() {
  const { excecoes, isLoading, error, alternar } = useExcecoesFerias()
  const [busca, setBusca] = useState('')

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return excecoes
    return excecoes.filter(
      (usuario) =>
        usuario.nome.toLowerCase().includes(termo) ||
        usuario.setor.toLowerCase().includes(termo),
    )
  }, [excecoes, busca])

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou setor…"
          className="h-9 pl-8"
        />
      </div>

      {error ? (
        <p className="py-6 text-center text-sm text-destructive">{error}</p>
      ) : isLoading ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {excecoes.length === 0
            ? 'Nenhum colaborador encontrado.'
            : 'Nenhum colaborador para essa busca.'}
        </p>
      ) : (
        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-4">Nome</TableHead>
                <TableHead className="h-11">Setor</TableHead>
                <TableHead className="h-11 w-20 text-center">Fracionar</TableHead>
                <TableHead className="h-11 w-20 text-center">Vender</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((usuario) => (
                <TableRow key={usuario.id} className="hover:bg-muted/50">
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 rounded-lg">
                        <AvatarImage
                          src={usuario.avatarUrl}
                          alt={usuario.nome}
                          className="rounded-lg object-cover"
                        />
                        <AvatarFallback className="rounded-lg bg-muted text-xs font-semibold">
                          {usuario.iniciais}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium leading-none">{usuario.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {usuario.setor}
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={usuario.podeFracionarFerias}
                      onCheckedChange={(valor) =>
                        alternar(usuario.id, 'podeFracionarFerias', valor)
                      }
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={usuario.podeVenderFerias}
                      onCheckedChange={(valor) =>
                        alternar(usuario.id, 'podeVenderFerias', valor)
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
