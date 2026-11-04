import { MODULOS_SIDEBAR } from '@/features/app/components/AppSidebar'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useModulosVisibilidade } from '@/features/tabelas/hooks'
import type { Papel } from '@/features/tabelas/types'

/** Uma matriz "módulo × papel": um switch por célula, coluna ADMIN travada marcada. */
function MatrizModuloPapel({
  papeis,
  valorPara,
  onToggle,
}: {
  papeis: Papel[]
  valorPara: (moduloCodigo: string, roleId: string) => boolean
  onToggle: (moduloCodigo: string, roleId: string, valor: boolean) => void
}) {
  return (
    <div className="scrollbar-thin overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-11 px-4">Módulo</TableHead>
            {papeis.map((papel) => (
              <TableHead key={papel.id} className="h-11 w-24 text-center">
                {papel.nome}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {MODULOS_SIDEBAR.map((modulo) => (
            <TableRow key={modulo.moduloCodigo} className="hover:bg-muted/50">
              <TableCell className="px-4 py-3 font-medium">{modulo.title}</TableCell>
              {papeis.map((papel) => {
                const ehAdmin = papel.codigo === 'ADMIN'
                return (
                  <TableCell key={papel.id} className="text-center">
                    <Switch
                      checked={ehAdmin || valorPara(modulo.moduloCodigo, papel.id)}
                      disabled={ehAdmin}
                      onCheckedChange={(valor) => onToggle(modulo.moduloCodigo, papel.id, valor)}
                    />
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Duas matrizes "módulo × papel" (tela Tabelas, ADMIN), cada uma com UM
 * switch por célula:
 *
 * - Visibilidade: decide quem vê cada item do sidebar e acessa a rota
 *   correspondente (ver moduloLiberado em features/auth/lib/modulos.ts).
 *   Célula marcada (sem exceção cadastrada) = visível, é o padrão;
 *   desmarcar grava uma negação explícita (modulos_visibilidade.visivel =
 *   FALSE).
 * - Liberação antecipada: enquanto o lançamento beta estiver ativo, todo
 *   módulo aparece com cadeado ("em desenvolvimento") pra quem não foi
 *   liberado aqui — o cadeado depende diretamente deste switch (ligado = sem
 *   cadeado; desligado, o padrão, = continua com cadeado). Só importa pra
 *   quem já é visível na matriz acima.
 *
 * ADMIN sempre vê/acessa tudo sem cadeado, independente desta tela — a
 * coluna ADMIN aparece travada marcada nas duas matrizes pra não sugerir o
 * contrário.
 */
export function ModulosVisibilidadeAdmin({ papeis }: { papeis: Papel[] }) {
  const { overrides, isLoading, error, alternar } = useModulosVisibilidade()

  function encontrar(moduloCodigo: string, roleId: string) {
    return overrides.find((o) => o.moduloCodigo === moduloCodigo && o.roleId === roleId)
  }

  if (error) {
    return <p className="py-6 text-center text-sm text-destructive">{error}</p>
  }
  if (isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
        <div>
          <h3 className="text-base font-semibold">Visibilidade de módulos</h3>
          <p className="text-sm text-muted-foreground">
            Decide quais papéis veem cada item do menu e conseguem acessar a página
            correspondente.
          </p>
        </div>
        <MatrizModuloPapel
          papeis={papeis}
          valorPara={(moduloCodigo, roleId) => encontrar(moduloCodigo, roleId)?.visivel ?? true}
          onToggle={(moduloCodigo, roleId, valor) =>
            alternar(moduloCodigo, roleId, 'visivel', valor)
          }
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-6">
        <div>
          <h3 className="text-base font-semibold">Liberação antecipada (lançamento beta)</h3>
          <p className="text-sm text-muted-foreground">
            Enquanto o lançamento estiver restrito, os módulos aparecem com cadeado — ainda em
            desenvolvimento pra quem não está marcado aqui. Marque pra liberar o acesso
            antecipadamente a um papel, mesmo com o lançamento geral ainda bloqueado.
          </p>
        </div>
        <MatrizModuloPapel
          papeis={papeis}
          valorPara={(moduloCodigo, roleId) =>
            encontrar(moduloCodigo, roleId)?.liberadoAntecipado ?? false
          }
          onToggle={(moduloCodigo, roleId, valor) =>
            alternar(moduloCodigo, roleId, 'liberadoAntecipado', valor)
          }
        />
      </div>
    </div>
  )
}
