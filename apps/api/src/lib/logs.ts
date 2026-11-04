import type { FastifyError, FastifyRequest } from "fastify";

import { getDatabase } from "./database.js";

/**
 * Log de erros — dois jeitos de parar aqui:
 *  - "backend": nenhuma rota reconheceu e tratou (qualquer status, não só
 *    500 — ver app.setErrorHandler em app.ts, único ponto que chama
 *    `registrarErroDaRequisicao`).
 *  - "frontend": o erro aconteceu inteiramente no navegador (ex.: falha ao
 *    compactar um PDF antes do upload) e NUNCA gera uma requisição — por
 *    isso o front reporta explicitamente via POST /logs/cliente, que chama
 *    `registrarErroCliente`. Não tem status HTTP de verdade (`statusHttp`
 *    fica null).
 * Ver db/migrations/032_logs_erros.sql e 033_logs_erros_origem.sql.
 */

export type OrigemLogErro = "backend" | "frontend";

export interface LogErroInput {
  origem: OrigemLogErro;
  modulo: string;
  rota: string;
  codigo: string;
  statusHttp: number | null;
  mensagem: string;
  stack: string | null;
  usuarioId: string | null;
  usuarioNome: string | null;
  usuarioEmail: string | null;
}

export interface LogErro extends LogErroInput {
  id: string;
  createdAt: string;
}

export async function registrarErro(input: LogErroInput): Promise<void> {
  const sql = getDatabase();
  await sql`
    INSERT INTO logs_erros (
      origem, modulo, rota, codigo, status_http, mensagem, stack,
      usuario_id, usuario_nome, usuario_email
    ) VALUES (
      ${input.origem}, ${input.modulo}, ${input.rota}, ${input.codigo}, ${input.statusHttp},
      ${input.mensagem}, ${input.stack},
      ${input.usuarioId}, ${input.usuarioNome}, ${input.usuarioEmail}
    )
  `;
}

interface LinhaLogErro {
  id: string;
  origem: OrigemLogErro;
  modulo: string;
  rota: string;
  codigo: string;
  status_http: number | null;
  mensagem: string;
  stack: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  usuario_email: string | null;
  created_at: Date | string;
}

export async function listLogsErros(limite = 100): Promise<LogErro[]> {
  const sql = getDatabase();
  const linhas = await sql<LinhaLogErro[]>`
    SELECT id, origem, modulo, rota, codigo, status_http, mensagem, stack,
           usuario_id, usuario_nome, usuario_email, created_at
    FROM logs_erros
    ORDER BY created_at DESC
    LIMIT ${limite}
  `;
  return linhas.map((linha) => ({
    id: linha.id,
    origem: linha.origem,
    modulo: linha.modulo,
    rota: linha.rota,
    codigo: linha.codigo,
    statusHttp: linha.status_http,
    mensagem: linha.mensagem,
    stack: linha.stack,
    usuarioId: linha.usuario_id,
    usuarioNome: linha.usuario_nome,
    usuarioEmail: linha.usuario_email,
    createdAt: linha.created_at instanceof Date ? linha.created_at.toISOString() : linha.created_at,
  }));
}

function extrairModulo(caminho: string): string {
  return caminho.split("/").filter(Boolean)[0] ?? "raiz";
}

function resolverCodigo(error: FastifyError): string {
  if (error.code) return error.code;
  if (error.name && error.name !== "Error") return error.name;
  if (error.statusCode) return String(error.statusCode);
  return "ERRO_DESCONHECIDO";
}

/**
 * Chamada pelo app.setErrorHandler global (app.ts) para TODO erro que chega
 * até ele — não só status >= 500 (ex.: 413 do @fastify/multipart quando o
 * diploma passa do limite também entra). Nunca lança — uma falha ao gravar
 * o log não pode derrubar a resposta de erro original que já está sendo
 * enviada ao cliente.
 */
export async function registrarErroDaRequisicao(
  error: FastifyError,
  request: FastifyRequest,
): Promise<void> {
  try {
    const caminho = request.routeOptions?.url ?? request.url;
    await registrarErro({
      origem: "backend",
      modulo: extrairModulo(caminho),
      rota: `${request.method} ${caminho}`,
      codigo: resolverCodigo(error),
      statusHttp: error.statusCode ?? 500,
      mensagem: error.message || "(sem mensagem)",
      stack: error.stack ?? null,
      usuarioId: request.user?.id ?? null,
      usuarioNome: request.user?.nome ?? null,
      usuarioEmail: request.user?.email ?? null,
    });
  } catch (falhaAoLogar) {
    console.error("[logs] falha ao gravar log de erro:", falhaAoLogar);
  }
}

export interface ErroClienteInput {
  modulo: string;
  rota: string;
  codigo?: string;
  mensagem: string;
  stack?: string | null;
}

/**
 * Chamada pela rota POST /logs/cliente — um erro que o PRÓPRIO FRONT detectou
 * e reportou (nunca virou uma requisição que o backend pudesse ver sozinho,
 * ex.: falha ao compactar um PDF no navegador antes do upload). Também nunca
 * lança, mesmo motivo de registrarErroDaRequisicao.
 */
export async function registrarErroCliente(
  input: ErroClienteInput,
  usuario: { id: string; nome: string; email: string },
): Promise<void> {
  try {
    await registrarErro({
      origem: "frontend",
      modulo: input.modulo,
      rota: input.rota,
      codigo: input.codigo ?? "ERRO_CLIENTE",
      statusHttp: null,
      mensagem: input.mensagem,
      stack: input.stack ?? null,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      usuarioEmail: usuario.email,
    });
  } catch (falhaAoLogar) {
    console.error("[logs] falha ao gravar log de erro do cliente:", falhaAoLogar);
  }
}
