import { useState } from 'react'
import { ArrowLeft, Info, RefreshCw, TriangleAlert } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { useLogsErros } from '../hooks/useLogsErros'
import type { LogErro } from '../types'

/**
 * Cor do badge de código/status. Erro de front-end (`statusHttp` null — não
 * houve requisição, não tem status HTTP de verdade) ganha uma cor neutra
 * própria, pra não confundir com um 2xx/3xx do backend.
 */
function corPorStatus(statusHttp: number | null): string {
  if (statusHttp === null) {
    return 'border-transparent bg-violet-100 text-violet-700 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-400'
  }
  if (statusHttp >= 500) {
    return 'border-transparent bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400'
  }
  if (statusHttp >= 400) {
    return 'border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
  }
  return 'border-transparent bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
}

const ORIGEM_LABEL: Record<LogErro['origem'], string> = {
  backend: 'Backend',
  frontend: 'Front-end',
}

function formatarData(valor: string): string {
  return new Date(valor).toLocaleString('pt-BR')
}

/**
 * Painel de detalhe de um log selecionado. `onVoltar` só existe em telas
 * pequenas (abaixo de `lg`, ver LogsErrosSection) — lá a lista e o detalhe
 * nunca aparecem juntos, então precisa de um jeito de voltar pra lista; a
 * partir de `lg` os dois ficam lado a lado o tempo todo, o botão nem
 * aparece (classe `lg:hidden`).
 */
function DetalheLog({ log, onVoltar }: { log: LogErro | null; onVoltar?: () => void }) {
  if (!log) {
    return (
      <Card className="shadow-none">
        <CardContent className="flex h-full min-h-64 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Selecione um log na lista para ver os detalhes.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader className="min-w-0 gap-2 pb-4">
        {onVoltar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit gap-1.5 text-muted-foreground lg:hidden"
            onClick={onVoltar}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`rounded-lg px-2 py-1 text-xs font-medium shadow-none ${corPorStatus(log.statusHttp)}`}
          >
            {log.codigo}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatarData(log.createdAt)}</span>
        </div>
        <CardTitle className="break-words text-base font-medium leading-snug">{log.mensagem}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <span className="text-muted-foreground">Origem</span>
          <span className="font-medium">{ORIGEM_LABEL[log.origem]}</span>
          <span className="text-muted-foreground">Módulo</span>
          <span className="break-words font-medium">{log.modulo}</span>
          <span className="text-muted-foreground">Rota</span>
          <span className="break-all font-mono text-xs">{log.rota}</span>
          <span className="text-muted-foreground">Usuário</span>
          <span className="break-words">
            {log.usuarioNome ?? '—'}
            {log.usuarioEmail ? ` (${log.usuarioEmail})` : ''}
          </span>
        </div>

        {log.stack ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Stack</span>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
              {log.stack}
            </pre>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * Exemplos já confirmados passando por este log — pura documentação pro
 * admin/dev, não afeta o que é capturado. Quem decide isso automaticamente
 * é: no backend, o app.setErrorHandler global (apps/api/src/app.ts — pega
 * QUALQUER erro inesperado de QUALQUER rota sem precisar registrar nada
 * aqui); no front, não tem automático — um erro client-side só vira log se
 * alguém chamar explicitamente `logsService.reportarErro(...)` (ver
 * apps/web/src/features/logs/services/logsService.ts) no catch dele.
 *
 * MANUTENÇÃO (Claude, ao implementar uma feature nova):
 *  - Backend: sempre que a feature envolver algo que pode falhar de um
 *    jeito "inesperado" — upload de arquivo, chamada a um serviço externo
 *    (storage, e-mail, LDAP/AD, sistema legado), processamento em lote,
 *    etc. — não precisa mexer em nada, o setErrorHandler já cobre; só
 *    acrescente uma entrada aqui contando o que passou a ser coberto.
 *  - Front-end: se a feature tiver uma etapa que roda só no navegador e
 *    pode falhar SEM nunca gerar uma requisição (compactação de arquivo,
 *    parsing pesado, qualquer `catch` que hoje só mostra um toast e some) —
 *    chame `logsService.reportarErro({ modulo, rota, mensagem, stack })`
 *    nesse catch, E acrescente uma entrada aqui. Sem essa chamada explícita,
 *    o erro simplesmente não existe pra este log — ninguém vai saber que
 *    aconteceu (foi exatamente o que faltou na compactação de PDF antes
 *    desta entrada existir).
 */
const FONTES_CONHECIDAS: { titulo: string; descricao: string }[] = [
  {
    titulo: 'Upload de diploma e certificado (Cursos e Qualificações)',
    descricao:
      'Falha ao enviar o arquivo para o storage (MinIO/S3) — caso real que motivou a criação deste log.',
  },
  {
    titulo: 'Arquivo de diploma/certificado maior que o limite permitido',
    descricao:
      'O @fastify/multipart recusa com 413 antes mesmo da rota rodar — nenhuma rota trata isso especificamente, então sem este log a formação/curso ficava salvo sem o anexo e ninguém percebia. O front já avisa o limite antes de enviar (ver TAMANHO_MAXIMO_ANEXO_MB em lib/cursos.ts), mas isto aqui é a rede de segurança.',
  },
  {
    titulo: 'Falha ao compactar um PDF no navegador (origem: Front-end)',
    descricao:
      'Diploma/certificado em PDF maior que o limite — o front tenta compactar automaticamente (ver lib/pdf.ts) antes de enviar; se a compactação falhar, isso NUNCA vira uma requisição (o backend não tem como ver sozinho), então o front reporta explicitamente via POST /logs/cliente. Caso real que motivou essa segunda via: testes de upload deram erro e nada aparecia aqui.',
  },
  {
    titulo: 'Erros de banco de dados não reconhecidos pela rota',
    descricao:
      'Ex.: coluna/tipo inválido, violação de constraint que a rota não esperava e não trata com uma mensagem própria.',
  },
]

/**
 * Lista de erros inesperados do backend + painel de detalhe ao lado.
 * Ferramenta de diagnóstico interna — só ADMIN acessa (ver /logs em App.tsx).
 */
export function LogsErrosSection() {
  const { logs, isLoading, recarregar } = useLogsErros()
  const [selecionado, setSelecionado] = useState<LogErro | null>(null)

  return (
    <div className="grid h-full min-h-0 grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      {/* Abaixo de `lg`, lista e detalhe nunca aparecem juntos — mostra só
          uma por vez (a tabela some quando um log tá selecionado, ver
          DetalheLog/onVoltar). A partir de `lg`, os dois ficam lado a lado
          sempre, como antes. */}
      <Card
        className={`${selecionado ? 'hidden lg:flex' : 'flex'} h-full min-h-0 min-w-0 flex-col overflow-hidden shadow-none`}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Logs de erros</CardTitle>
          <div className="flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label="O que entra aqui"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>O que entra aqui</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <p>
                    Duas origens: <strong className="text-foreground">Backend</strong> —
                    qualquer erro que nenhuma rota reconheceu e tratou, capturado
                    automaticamente em qualquer rota da API, não importa o código HTTP
                    (pode ser 500, mas também um 413 de arquivo grande demais, por
                    exemplo); erros de validação que a própria rota já trata com uma
                    mensagem amigável (ex.: "já existe", campo obrigatório, permissão
                    negada) não entram aqui. <strong className="text-foreground">Front-end</strong> —
                    erros que acontecem só no navegador e nunca chegam a virar uma
                    requisição (ex.: falha ao compactar um PDF antes do upload); o
                    próprio front reporta esses explicitamente, já que o backend não tem
                    como ver sozinho.
                  </p>
                  <ul className="list-disc space-y-1.5 pl-4">
                    {FONTES_CONHECIDAS.map((fonte) => (
                      <li key={fonte.titulo}>
                        <span className="font-medium text-foreground">{fonte.titulo}:</span>{' '}
                        {fonte.descricao}
                      </li>
                    ))}
                  </ul>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Atualizar"
              onClick={() => recarregar()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
          {isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <TriangleAlert className="h-6 w-6 opacity-60" />
              Nenhum erro registrado até agora.
            </div>
          ) : (
            <div className="scrollbar-thin h-full overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-9 px-4">Data</TableHead>
                    <TableHead className="h-9">Módulo</TableHead>
                    <TableHead className="h-9">Código</TableHead>
                    <TableHead className="h-9">Mensagem</TableHead>
                    <TableHead className="h-9 pr-4">Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className={`cursor-pointer hover:bg-muted/50 ${selecionado?.id === log.id ? 'bg-muted/50' : ''}`}
                      onClick={() => setSelecionado(log)}
                    >
                      <TableCell className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                        {formatarData(log.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 text-sm">{log.modulo}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`rounded-lg px-2 py-1 text-xs font-medium shadow-none ${corPorStatus(log.statusHttp)}`}
                        >
                          {log.codigo}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 text-sm text-muted-foreground lg:max-w-xs lg:truncate">
                        {log.mensagem}
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-2 pr-4 text-sm text-muted-foreground lg:max-w-[140px] lg:truncate">
                        {log.usuarioNome ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className={`min-w-0 ${selecionado ? 'block' : 'hidden lg:block'}`}>
        <DetalheLog log={selecionado} onVoltar={() => setSelecionado(null)} />
      </div>
    </div>
  )
}
