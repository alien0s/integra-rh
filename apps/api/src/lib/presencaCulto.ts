// apps/api/src/lib/presencaCulto.ts
// Camada de dados do módulo Presença no Culto (queries + transações).
// Regras de negócio ficam em presencaCulto.regras.ts.

import { getDatabase } from './database.js'
import { STATUS_PRESENCA, PAPEL } from '../types/presencaCulto.js'
import type { PresencaCulto, AcaoHistorico, ItemRanking } from '../types/presencaCulto.js'
import {
  paraDataISO,
  resolverAprovadores,
  calcularResumo,
  montarRanking,
} from './presencaCulto.regras.js'
import type { ContextoAprovacao } from './presencaCulto.regras.js'

// =============================================================================
// Colunas da tabela users usadas pelo módulo
// =============================================================================
const COL_USUARIO = {
  nome: 'nome',
  ativo: 'is_active' as string | null,
  foto: 'avatar_url' as string | null,
}

function nomeDe(sql: any, alias: string) {
  return sql(`${alias}.${COL_USUARIO.nome}`)
}

function fotoDe(sql: any, alias: string) {
  return COL_USUARIO.foto ? sql`${sql(`${alias}.${COL_USUARIO.foto}`)}` : sql`NULL`
}

function apenasAtivos(sql: any, alias: string) {
  return COL_USUARIO.ativo ? sql`AND ${sql(`${alias}.${COL_USUARIO.ativo}`)} = true` : sql``
}

// Dentro do rodaComoUsuario o getDatabase() já é uma transação (sem .begin);
// nesse caso usa savepoint, que dá o mesmo "tudo ou nada" pro trecho.
function emTransacao(sql: any, fn: (tx: any) => Promise<any>) {
  if (typeof sql.begin === 'function') return sql.begin(fn)
  return sql.savepoint(fn)
}

// =============================================================================
// Datas
// =============================================================================

// Data de hoje no fuso de Manaus, 'YYYY-MM-DD'
export function hojeISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Manaus' }).format(new Date())
}

export function intervaloDoMes(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fim }
}

// =============================================================================
// Usuários e contexto de aprovação
// =============================================================================

async function carregarAprovadoresGlobais(sql: any) {
  const [g] = await sql`
    SELECT
      (SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
         JOIN setor s ON s.id = u.setor_id AND s.gestor_id = u.id
        WHERE r.codigo = ${PAPEL.RH} ${apenasAtivos(sql, 'u')}
        LIMIT 1) AS gerente_rh_id,
      (SELECT u.id
         FROM users u
         JOIN roles r ON r.id = u.role_id
        WHERE r.codigo = ${PAPEL.TESOUREIRO} ${apenasAtivos(sql, 'u')}
        ORDER BY u.id
        LIMIT 1) AS tesoureiro_id
  `
  return g
}

async function consultarUsuarios(sql: any, userId?: string) {
  return sql`
    SELECT u.id,
           ${nomeDe(sql, 'u')} AS nome,
           u.email,
           ${fotoDe(sql, 'u')} AS foto_url,
           u.setor_id,
           s.nome AS setor_nome,
           r.codigo AS papel,
           s.gestor_id,
           ss.superior_id,
           u.entity_id,
           e.nome AS entidade_nome,
           ea.assistente_id
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN setor s ON s.id = u.setor_id -- setor_id = setor principal (sincronizado com user_setor)
      LEFT JOIN presenca_culto_setor_superior ss ON ss.setor_id = u.setor_id
      LEFT JOIN entities e ON e.id = u.entity_id
      LEFT JOIN presenca_culto_entidade_assistente ea ON ea.entity_id = u.entity_id
     WHERE TRUE
       ${apenasAtivos(sql, 'u')}
       ${userId ? sql`AND u.id = ${userId}` : sql``}
     ORDER BY 2
  `
}

function montarContexto(u: any, g: any): ContextoAprovacao {
  return {
    pessoa: { id: u.id, papel: u.papel, setor_id: u.setor_id },
    gestorSetorId: u.gestor_id ?? null,
    superiorSetorId: u.superior_id ?? null,
    gerenteRhId: g.gerente_rh_id ?? null,
    tesoureiroId: g.tesoureiro_id ?? null,
    assistenteId: u.assistente_id ?? null, // Tesoureiro Assistente da entidade da pessoa
  }
}

// Usuário + quem aprova as justificativas dele
export async function buscarUsuarioComAprovadores(userId: string) {
  const sql = getDatabase()
  const [u] = await consultarUsuarios(sql, userId)
  if (!u) return null
  const g = await carregarAprovadoresGlobais(sql)
  const aprovadores = resolverAprovadores(montarContexto(u, g))
  return { usuario: u, aprovadores } // aprovadores pode ser string (motivo do erro)
}

// Todos os usuários cujo líder resolvido é liderId (área do gerente)
export async function listarEquipeDoLider(liderId: string) {
  const sql = getDatabase()
  const [usuarios, g] = await Promise.all([consultarUsuarios(sql), carregarAprovadoresGlobais(sql)])

  return usuarios.filter((u: any) => {
    if (u.id === liderId) return false
    const a = resolverAprovadores(montarContexto(u, g))
    return typeof a !== 'string' && a.lider_id === liderId
  })
}

export async function listarUsuarios() {
  return consultarUsuarios(getDatabase())
}

// =============================================================================
// Registros
// =============================================================================

export async function buscarRegistro(id: string): Promise<PresencaCulto | null> {
  const sql = getDatabase()
  const [r] = await sql`SELECT * FROM presenca_culto WHERE id = ${id}`
  return (r as any) ?? null
}

export async function listarRegistrosDoUsuario(userId: string, inicio: string, fim: string) {
  const sql = getDatabase()
  return sql`
    SELECT *
      FROM presenca_culto
     WHERE user_id = ${userId}
       AND data BETWEEN ${inicio} AND ${fim}
     ORDER BY data
  ` as any as Promise<PresencaCulto[]>
}

// Tela de ajuste manual do RH: todo mundo de um dia
export async function listarRegistrosPorData(data: string) {
  const sql = getDatabase()
  return sql`
    SELECT p.*,
           ${nomeDe(sql, 'u')} AS usuario_nome,
           u.email AS usuario_email,
           ${fotoDe(sql, 'u')} AS usuario_foto,
           s.nome AS setor_nome
      FROM presenca_culto p
      LEFT JOIN users u ON u.id = p.user_id
      LEFT JOIN setor s ON s.id = u.setor_id
     WHERE p.data = ${data}
     ORDER BY COALESCE(${nomeDe(sql, 'u')}, p.nome)
  `
}

// Registros que a carga mandou com código APS que não casou com ninguém
export async function listarRegistrosSemUsuario(inicio: string, fim: string) {
  const sql = getDatabase()
  return sql`
    SELECT *
      FROM presenca_culto
     WHERE user_id IS NULL
       AND data BETWEEN ${inicio} AND ${fim}
     ORDER BY data DESC, nome
  `
}

// Contagem por status (cards da área do gerente)
export async function contarPorUsuario(userIds: string[], inicio: string, fim: string) {
  if (!userIds.length) return []
  const sql = getDatabase()
  return sql`
    SELECT user_id,
           COUNT(*) FILTER (WHERE status = ${STATUS_PRESENCA.PRESENTE})     ::int AS presentes,
           COUNT(*) FILTER (WHERE status = ${STATUS_PRESENCA.ATRASO})       ::int AS atrasos,
           COUNT(*) FILTER (WHERE status = ${STATUS_PRESENCA.FALTA})        ::int AS faltas,
           COUNT(*) FILTER (WHERE status = ${STATUS_PRESENCA.EM_APROVACAO}) ::int AS em_aprovacao,
           COUNT(*) FILTER (WHERE status = ${STATUS_PRESENCA.JUSTIFICADO})  ::int AS justificados
      FROM presenca_culto
     WHERE user_id IN ${sql(userIds)}
       AND data BETWEEN ${inicio} AND ${fim}
     GROUP BY user_id
  `
}

// =============================================================================
// Transições (justificar, decidir, ajustar) com histórico na mesma transação
// =============================================================================

export type ResultadoTransicao =
  | { patch: Record<string, any>; acao: AcaoHistorico; comentario?: string | null }
  | string

class ErroTransicao extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

// Campos guardados no histórico como "antes"
function fotografar(r: any) {
  return {
    status: r.status,
    hora: r.hora,
    pontuacao: r.pontuacao,
    status_original: r.status_original,
    pontuacao_original: r.pontuacao_original,
    tipo_justificativa: r.tipo_justificativa,
    justificativa_texto: r.justificativa_texto,
    anexo_path: r.anexo_path,
    status_lider: r.status_lider,
    status_final: r.status_final,
    segunda_chance: r.segunda_chance,
    descontar_no_ranking: r.descontar_no_ranking,
  }
}

async function transicionar(
  tx: any,
  id: string,
  usuarioId: string,
  fn: (r: PresencaCulto) => ResultadoTransicao
) {
  // FOR UPDATE: duas pessoas clicando "aprovar" ao mesmo tempo não passam juntas
  const [r] = await tx`SELECT * FROM presenca_culto WHERE id = ${id} FOR UPDATE`
  if (!r) throw new ErroTransicao('Registro não encontrado.', 404)

  const res = fn(r)
  if (typeof res === 'string') throw new ErroTransicao(res, 400)

  const [atualizado] = await tx`
    UPDATE presenca_culto
       SET ${tx(res.patch)}
     WHERE id = ${id}
     RETURNING *
  `

  await tx`
    INSERT INTO presenca_culto_historico (presenca_id, acao, usuario_id, comentario, dados)
    VALUES (
      ${id},
      ${res.acao},
      ${usuarioId},
      ${res.comentario ?? null},
      ${tx.json({ antes: fotografar(r), depois: res.patch })}
    )
  `

  return { anterior: r as PresencaCulto, atualizado: atualizado as PresencaCulto }
}

// Uma transição. Retorna { data } ou { erro, status }.
export async function aplicarTransicao(
  id: string,
  usuarioId: string,
  fn: (r: PresencaCulto) => ResultadoTransicao
) {
  const sql = getDatabase()
  try {
    const resultado = await emTransacao(sql, (tx: any) => transicionar(tx, id, usuarioId, fn))
    return { data: resultado }
  } catch (e: any) {
    if (e instanceof ErroTransicao) return { erro: e.message, status: e.status }
    throw e
  }
}

// Várias transições, tudo ou nada (líder justificando várias datas)
export async function aplicarTransicaoEmLote(
  ids: string[],
  usuarioId: string,
  fn: (r: PresencaCulto) => ResultadoTransicao
) {
  const sql = getDatabase()
  try {
    const resultados = await emTransacao(sql, async (tx: any) => {
      const lista = []
      for (const id of ids) lista.push(await transicionar(tx, id, usuarioId, fn))
      return lista
    })
    return { data: resultados }
  } catch (e: any) {
    if (e instanceof ErroTransicao) return { erro: e.message, status: e.status }
    throw e
  }
}

export async function listarHistorico(presencaId: string) {
  const sql = getDatabase()
  return sql`
    SELECT h.*, ${nomeDe(sql, 'u')} AS usuario_nome
      FROM presenca_culto_historico h
      LEFT JOIN users u ON u.id = h.usuario_id
     WHERE h.presenca_id = ${presencaId}
     ORDER BY h.criado_em
  `
}

// =============================================================================
// Justificativas e filas de aprovação
// =============================================================================

function consultarJustificativas(sql: any, filtro: any) {
  return sql`
    SELECT p.*,
           ${nomeDe(sql, 'pu')} AS usuario_nome,
           pu.email             AS usuario_email,
           ${fotoDe(sql, 'pu')} AS usuario_foto,
           s.nome               AS setor_nome,
           ${nomeDe(sql, 'lu')} AS lider_nome,
           ${nomeDe(sql, 'fu')} AS final_nome,
           ${nomeDe(sql, 'ju')} AS justificado_por_nome
      FROM presenca_culto p
      LEFT JOIN users pu ON pu.id = p.user_id
      LEFT JOIN setor s  ON s.id  = pu.setor_id
      LEFT JOIN users lu ON lu.id = p.lider_id
      LEFT JOIN users fu ON fu.id = p.final_aprovador_id
      LEFT JOIN users ju ON ju.id = p.justificado_por
     WHERE ${filtro}
     ORDER BY p.data DESC, usuario_nome
  `
}

// O que está esperando a decisão deste líder (qualquer mês)
export async function filaDoLider(liderId: string) {
  const sql = getDatabase()
  return consultarJustificativas(
    sql,
    sql`p.status = ${STATUS_PRESENCA.EM_APROVACAO}
        AND p.lider_id = ${liderId}
        AND p.status_lider IS NULL`
  )
}

// O que está esperando o veredito final deste aprovador (qualquer mês)
export async function filaFinal(aprovadorId: string) {
  const sql = getDatabase()
  return consultarJustificativas(
    sql,
    sql`p.status = ${STATUS_PRESENCA.EM_APROVACAO}
        AND p.final_aprovador_id = ${aprovadorId}
        AND p.status_final IS NULL
        AND (p.lider_id IS NULL OR p.status_lider = 'Aprovada')`
  )
}

// Visão geral (RH/Admin/Tesoureiro): todas as justificativas do período
export async function listarJustificativas(inicio: string, fim: string) {
  const sql = getDatabase()
  return consultarJustificativas(
    sql,
    sql`p.justificado_em IS NOT NULL
        AND p.data BETWEEN ${inicio} AND ${fim}`
  )
}

// =============================================================================
// Calendário
// =============================================================================

export async function listarCalendario(inicio: string, fim: string) {
  const sql = getDatabase()
  return sql`
    SELECT *
      FROM presenca_culto_calendario
     WHERE data BETWEEN ${inicio} AND ${fim}
     ORDER BY data
  `
}

export async function datasDoCalendario(inicio: string, fim: string): Promise<string[]> {
  const linhas = await listarCalendario(inicio, fim)
  return linhas.map((l: any) => paraDataISO(l.data))
}

// Substitui os dias de culto de um mês pelos informados
export async function salvarCalendarioDoMes(
  ano: number,
  mes: number,
  datas: string[],
  usuarioId: string
) {
  const sql = getDatabase()
  const { inicio, fim } = intervaloDoMes(ano, mes)
  const unicas = [...new Set(datas.map(paraDataISO))].filter((d) => d >= inicio && d <= fim)

  await emTransacao(sql, async (tx: any) => {
    if (unicas.length) {
      await tx`
        DELETE FROM presenca_culto_calendario
         WHERE data BETWEEN ${inicio} AND ${fim}
           AND data NOT IN ${tx(unicas)}
      `
      const linhas = unicas.map((data) => ({ data, criado_por: usuarioId }))
      await tx`
        INSERT INTO presenca_culto_calendario ${tx(linhas, 'data', 'criado_por')}
        ON CONFLICT (data) DO NOTHING
      `
    } else {
      await tx`DELETE FROM presenca_culto_calendario WHERE data BETWEEN ${inicio} AND ${fim}`
    }
  })

  return datasDoCalendario(inicio, fim)
}

// =============================================================================
// Períodos de premiação
// =============================================================================

const CAMPOS_PERIODO = [
  'nome',
  'data_inicio',
  'data_fim',
  'data_premiacao',
  'recurso_inicio',
  'recurso_fim',
  'fechado',
]

function filtrarCampos(obj: any, campos: string[]) {
  const saida: Record<string, any> = {}
  for (const c of campos) if (obj[c] !== undefined) saida[c] = obj[c]
  return saida
}

export async function listarPeriodos() {
  const sql = getDatabase()
  return sql`SELECT * FROM presenca_culto_periodo ORDER BY data_inicio DESC`
}

export async function buscarPeriodo(id: string) {
  const sql = getDatabase()
  const [p] = await sql`SELECT * FROM presenca_culto_periodo WHERE id = ${id}`
  return p ?? null
}

// Período que contém a data (ou o último que já começou, se estiver entre períodos)
export async function periodoVigente(data: string) {
  const sql = getDatabase()
  const [p] = await sql`
    SELECT *
      FROM presenca_culto_periodo
     WHERE data_inicio <= ${data}
     ORDER BY (data_fim >= ${data}) DESC, data_inicio DESC
     LIMIT 1
  `
  return p ?? null
}

export async function criarPeriodo(input: any, usuarioId: string) {
  const sql = getDatabase()
  const dados = { ...filtrarCampos(input, CAMPOS_PERIODO), criado_por: usuarioId }
  const [p] = await sql`
    INSERT INTO presenca_culto_periodo ${sql(dados)}
    RETURNING *
  `
  return p
}

export async function atualizarPeriodo(id: string, input: any) {
  const sql = getDatabase()
  const dados = filtrarCampos(input, CAMPOS_PERIODO)
  if (!Object.keys(dados).length) return buscarPeriodo(id)
  const [p] = await sql`
    UPDATE presenca_culto_periodo
       SET ${sql(dados)}
     WHERE id = ${id}
     RETURNING *
  `
  return p ?? null
}

export async function excluirPeriodo(id: string) {
  const sql = getDatabase()
  const [p] = await sql`DELETE FROM presenca_culto_periodo WHERE id = ${id} RETURNING id`
  return !!p
}

// =============================================================================
// Superior do setor
// =============================================================================

export async function listarSetoresComSuperior() {
  const sql = getDatabase()
  return sql`
    SELECT s.id AS setor_id,
           s.nome AS setor_nome,
           s.gestor_id,
           ${nomeDe(sql, 'g')} AS gestor_nome,
           ss.superior_id,
           ${nomeDe(sql, 'sup')} AS superior_nome,
           ss.atualizado_em
      FROM setor s
      LEFT JOIN users g   ON g.id = s.gestor_id
      LEFT JOIN presenca_culto_setor_superior ss ON ss.setor_id = s.id
      LEFT JOIN users sup ON sup.id = ss.superior_id
     ORDER BY s.nome
  `
}

export async function definirSuperiorDoSetor(setorId: string, superiorId: string, usuarioId: string) {
  const sql = getDatabase()
  const [linha] = await sql`
    INSERT INTO presenca_culto_setor_superior (setor_id, superior_id, atualizado_por, atualizado_em)
    VALUES (${setorId}, ${superiorId}, ${usuarioId}, now())
    ON CONFLICT (setor_id) DO UPDATE
       SET superior_id    = EXCLUDED.superior_id,
           atualizado_por = EXCLUDED.atualizado_por,
           atualizado_em  = now()
    RETURNING *
  `
  return linha
}

export async function removerSuperiorDoSetor(setorId: string) {
  const sql = getDatabase()
  const [linha] = await sql`
    DELETE FROM presenca_culto_setor_superior WHERE setor_id = ${setorId} RETURNING setor_id
  `
  return !!linha
}

// =============================================================================
// Tesoureiro Assistente por entidade
// =============================================================================

export async function listarEntidadesComAssistente() {
  const sql = getDatabase()
  return sql`
    SELECT e.id AS entity_id,
           e.nome AS entidade_nome,
           ea.assistente_id,
           ${nomeDe(sql, 'a')} AS assistente_nome,
           ea.atualizado_em
      FROM entities e
      LEFT JOIN presenca_culto_entidade_assistente ea ON ea.entity_id = e.id
      LEFT JOIN users a ON a.id = ea.assistente_id
     ORDER BY e.nome
  `
}

export async function definirAssistenteDaEntidade(entityId: string, assistenteId: string, usuarioId: string) {
  const sql = getDatabase()
  const [linha] = await sql`
    INSERT INTO presenca_culto_entidade_assistente (entity_id, assistente_id, atualizado_por, atualizado_em)
    VALUES (${entityId}, ${assistenteId}, ${usuarioId}, now())
    ON CONFLICT (entity_id) DO UPDATE
       SET assistente_id  = EXCLUDED.assistente_id,
           atualizado_por = EXCLUDED.atualizado_por,
           atualizado_em  = now()
    RETURNING *
  `
  return linha
}

export async function removerAssistenteDaEntidade(entityId: string) {
  const sql = getDatabase()
  const [linha] = await sql`
    DELETE FROM presenca_culto_entidade_assistente WHERE entity_id = ${entityId} RETURNING entity_id
  `
  return !!linha
}

// =============================================================================
// Resumo e ranking
// =============================================================================

export async function resumoDoUsuario(userId: string, inicio: string, fim: string) {
  const [registros, calendario] = await Promise.all([
    listarRegistrosDoUsuario(userId, inicio, fim),
    datasDoCalendario(inicio, fim),
  ])
  return calcularResumo({ userId, registros, calendario, inicio, fim, hoje: hojeISO() })
}

// Ranking do período. userIds restringe o universo (ex.: setor do gerente).
export async function rankingDoPeriodo(inicio: string, fim: string, userIds?: string[]) {
  const sql = getDatabase()
  if (userIds && !userIds.length) return [] as ItemRanking[]

  const [registros, calendario, usuarios] = await Promise.all([
    sql`
      SELECT *
        FROM presenca_culto
       WHERE user_id IS NOT NULL
         AND data BETWEEN ${inicio} AND ${fim}
         ${userIds ? sql`AND user_id IN ${sql(userIds)}` : sql``}
    `,
    datasDoCalendario(inicio, fim),
    consultarUsuarios(sql),
  ])

  const porUsuario = new Map<string, PresencaCulto[]>()
  for (const r of registros as any[]) {
    if (!porUsuario.has(r.user_id)) porUsuario.set(r.user_id, [])
    porUsuario.get(r.user_id)!.push(r)
  }

  const infoUsuario = new Map<string, any>(usuarios.map((u: any) => [u.id, u]))
  const hoje = hojeISO()

  const itens = [...porUsuario.entries()]
    .filter(([userId]) => infoUsuario.has(userId)) // só usuários ativos
    .map(([userId, regs]) => {
      const u = infoUsuario.get(userId)
      const resumo = calcularResumo({ userId, registros: regs, calendario, inicio, fim, hoje })
      return {
        ...resumo,
        nome: u.nome,
        email: u.email,
        setor_id: u.setor_id,
        setor_nome: u.setor_nome,
        foto_url: u.foto_url,
      }
    })

  return montarRanking(itens)
}