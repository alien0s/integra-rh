// apps/api/src/lib/presencaCulto.regras.ts
// Funções puras do módulo Presença no Culto: sem banco, sem req/res.
// As rotas buscam os dados, chamam estas funções e gravam o patch retornado.

import {
  STATUS_PRESENCA,
  DECISAO,
  ETAPA,
  FAIXAS_PONTUACAO,
  PONTOS_APOS_ULTIMA_FAIXA,
  PONTOS_MAXIMOS_POR_DIA,
  HORARIO_PONTUAL,
  CATEGORIAS,
  PAPEIS_DIRETO_FINAL,
  PONTUACAO_JUSTIFICADA,
  TIPOS_JUSTIFICATIVA,
  ANEXO_MIMES_PERMITIDOS,
  ANEXO_TAMANHO_MAXIMO,
  tipoDescontaNoRanking,
} from '../types/presencaCulto.js'
import type {
  PresencaCulto,
  Etapa,
  ResumoPresenca,
  ItemRanking,
  AjusteManualInput,
} from '../types/presencaCulto.js'

// =============================================================================
// Datas e horas
// =============================================================================

// postgres.js devolve DATE como Date (meia-noite UTC) — normaliza pra 'YYYY-MM-DD'
export function paraDataISO(d: any): string {
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

// '07:30:50' -> '07:30'
export function horaHHMM(hora: string | null | undefined): string | null {
  if (!hora) return null
  const m = String(hora).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return null
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

export function horaValida(hora: string) {
  const hhmm = horaHHMM(hora)
  if (!hhmm) return false
  const [h, m] = hhmm.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

// =============================================================================
// Pontuação e status por horário
// =============================================================================

export function pontuacaoPorHora(hora: string | null | undefined): number {
  const hhmm = horaHHMM(hora)
  if (!hhmm) return PONTOS_APOS_ULTIMA_FAIXA
  for (const faixa of FAIXAS_PONTUACAO) {
    if (hhmm <= faixa.ate) return faixa.pontos
  }
  return PONTOS_APOS_ULTIMA_FAIXA
}

// Chegou depois da última faixa (07:40) = Atraso
export function statusPorHora(hora: string | null | undefined) {
  return pontuacaoPorHora(hora) > PONTOS_APOS_ULTIMA_FAIXA
    ? STATUS_PRESENCA.PRESENTE
    : STATUS_PRESENCA.ATRASO
}

export function chegouPontual(hora: string | null | undefined) {
  const hhmm = horaHHMM(hora)
  return !!hhmm && hhmm <= HORARIO_PONTUAL
}

export function categoriaPorAproveitamento(aproveitamento: number) {
  for (const c of CATEGORIAS) {
    if (aproveitamento >= c.minimo) return c.nome
  }
  return CATEGORIAS[CATEGORIAS.length - 1].nome
}

// =============================================================================
// Etapa da justificativa (calculada, não fica no banco)
// =============================================================================

export function etapaDoRegistro(r: PresencaCulto): Etapa {
  if (r.status !== STATUS_PRESENCA.EM_APROVACAO) {
    return r.justificado_em ? ETAPA.CONCLUIDA : ETAPA.SEM_JUSTIFICATIVA
  }
  if (r.lider_id && !r.status_lider) return ETAPA.AGUARDANDO_LIDER
  return ETAPA.AGUARDANDO_FINAL
}

// Falta que já teve justificativa negada (legenda "Falta justificada e negada")
export function faltaNegada(r: PresencaCulto) {
  return (
    r.status === STATUS_PRESENCA.FALTA &&
    (r.status_lider === DECISAO.NEGADA || r.status_final === DECISAO.NEGADA)
  )
}

// =============================================================================
// Escada de aprovação
// =============================================================================

export interface ContextoAprovacao {
  pessoa: { id: string; papel: string; setor_id: string | null }
  gestorSetorId: string | null // setor.gestor_id da pessoa
  superiorSetorId: string | null // presenca_culto_setor_superior da pessoa
  gerenteRhId: string | null // papel RH + gestor_id do próprio setor
  tesoureiroId: string | null // primeiro usuário ativo com papel TESOUREIRO
  assistenteId: string | null // Tesoureiro Assistente da entidade da pessoa (presenca_culto_entidade_assistente)
}

export interface Aprovadores {
  lider_id: string | null
  final_aprovador_id: string
}

// Retorna os aprovadores ou uma string com o motivo de não conseguir resolver
export function resolverAprovadores(ctx: ContextoAprovacao): Aprovadores | string {
  const { pessoa } = ctx

  // Etapa final: gerente de RH; se quem faltou é ele, o Tesoureiro
  const final = pessoa.id === ctx.gerenteRhId ? ctx.tesoureiroId : ctx.gerenteRhId
  if (!final) {
    return pessoa.id === ctx.gerenteRhId
      ? 'Nenhum Tesoureiro cadastrado para aprovar esta justificativa.'
      : 'Gerente de RH não encontrado. Verifique o gestor do setor de RH.'
  }
  if (final === pessoa.id) {
    return 'O aprovador final não pode aprovar a própria justificativa.'
  }

  // Direção e o próprio gerente de RH vão direto pro final
  if (pessoa.id === ctx.gerenteRhId || (PAPEIS_DIRETO_FINAL as string[]).includes(pessoa.papel)) {
    return { lider_id: null, final_aprovador_id: final }
  }

  // Escada do líder: gestor do setor > superior do setor > Tesoureiro Assistente da entidade.
  // Sem nenhum dos três, vira etapa única (direto pro final).
  const candidatos = [ctx.gestorSetorId, ctx.superiorSetorId, ctx.assistenteId]
  const lider = candidatos.find((id) => !!id && id !== pessoa.id) ?? null

  // Líder igual ao final (ex.: analista de RH) = etapa única
  if (!lider || lider === final) {
    return { lider_id: null, final_aprovador_id: final }
  }

  return { lider_id: lider, final_aprovador_id: final }
}

// =============================================================================
// Permissões (retornam null quando pode, ou o motivo quando não pode)
// =============================================================================

export function motivoNaoPodeJustificar(r: PresencaCulto): string | null {
  if (r.status !== STATUS_PRESENCA.FALTA) return 'Apenas faltas podem ser justificadas.'
  if (faltaNegada(r)) return 'A justificativa desta falta já foi negada.'
  return null
}

// Colaborador justificando a própria falta
export function motivoNaoPodeJustificarPropria(r: PresencaCulto, usuarioId: string) {
  if (r.user_id !== usuarioId) return 'Este registro não é seu.'
  return motivoNaoPodeJustificar(r)
}

// Líder justificando por um funcionário (aprovadores já resolvidos pra essa pessoa)
export function motivoNaoPodeJustificarPor(
  r: PresencaCulto,
  usuarioId: string,
  aprovadores: Aprovadores
) {
  if (r.user_id === usuarioId) return 'Use a justificativa própria para os seus registros.'
  if (aprovadores.lider_id !== usuarioId) return 'Você não é o líder deste colaborador.'
  return motivoNaoPodeJustificar(r)
}

export function motivoNaoPodeDecidirLider(
  r: PresencaCulto,
  usuarioId: string,
  acao: 'APROVAR' | 'NEGAR' | 'DEVOLVER'
) {
  if (etapaDoRegistro(r) !== ETAPA.AGUARDANDO_LIDER) return 'Esta justificativa não está aguardando o líder.'
  if (r.lider_id !== usuarioId) return 'Você não é o líder designado para esta justificativa.'
  if (acao === 'DEVOLVER' && r.segunda_chance) return 'A segunda chance já foi usada.'
  return null
}

export function motivoNaoPodeDecidirFinal(r: PresencaCulto, usuarioId: string) {
  if (etapaDoRegistro(r) !== ETAPA.AGUARDANDO_FINAL) return 'Esta justificativa não está aguardando o veredito final.'
  if (r.final_aprovador_id !== usuarioId) return 'Você não é o aprovador final desta justificativa.'
  return null
}

export function motivoNaoPodeAjustar(r: PresencaCulto) {
  if (r.status === STATUS_PRESENCA.EM_APROVACAO) {
    return 'Há uma justificativa em aprovação. Conclua a aprovação antes de ajustar.'
  }
  return null
}

// =============================================================================
// Validações de entrada
// =============================================================================

export function validarJustificativa(tipo: any, texto: any): string | null {
  if (!TIPOS_JUSTIFICATIVA.includes(tipo)) return 'Tipo de justificativa inválido.'
  if (!texto || !String(texto).trim()) return 'Informe o motivo da justificativa.'
  return null
}

export function validarAnexo(mime: string | null | undefined, tamanho: number | null | undefined) {
  if (!mime) return null // anexo é opcional
  if (!ANEXO_MIMES_PERMITIDOS.includes(mime)) return 'Formato de anexo não permitido. Use PDF ou imagem.'
  if ((tamanho ?? 0) > ANEXO_TAMANHO_MAXIMO) return 'O anexo deve ter no máximo 5 MB.'
  return null
}

export function validarComentarioObrigatorio(acao: string, comentario: any): string | null {
  const obrigatorio = acao === 'NEGAR' || acao === 'DEVOLVER'
  if (obrigatorio && (!comentario || !String(comentario).trim())) {
    return 'Informe um comentário.'
  }
  return null
}

// =============================================================================
// Transições: cada função devolve só os campos que mudam (patch pro UPDATE)
// =============================================================================

const LIMPAR_JUSTIFICATIVA = {
  tipo_justificativa: null,
  justificativa_texto: null,
  justificado_por: null,
  justificado_em: null,
  anexo_path: null,
  anexo_nome: null,
  anexo_mime: null,
  lider_id: null,
  status_lider: null,
  comentario_lider: null,
  lider_em: null,
  final_aprovador_id: null,
  status_final: null,
  comentario_final: null,
  final_em: null,
  descontar_no_ranking: false,
}

function reverterParaOriginal(r: PresencaCulto) {
  return { status: r.status_original, pontuacao: r.pontuacao_original }
}

export function patchJustificar(params: {
  tipo: string
  texto: string
  autorId: string
  aprovadores: Aprovadores
  porLider: boolean
  anexo?: { path: string; nome: string; mime: string } | null
  agora?: Date
}) {
  const agora = params.agora ?? new Date()
  const { aprovadores, porLider } = params

  // Quando o líder justifica pelo funcionário, a etapa dele já nasce aprovada
  const liderJaAprovou = porLider && !!aprovadores.lider_id

  return {
    status: STATUS_PRESENCA.EM_APROVACAO,
    tipo_justificativa: params.tipo,
    justificativa_texto: String(params.texto).trim(),
    justificado_por: params.autorId,
    justificado_em: agora,
    anexo_path: params.anexo?.path ?? null,
    anexo_nome: params.anexo?.nome ?? null,
    anexo_mime: params.anexo?.mime ?? null,
    lider_id: aprovadores.lider_id,
    status_lider: liderJaAprovou ? DECISAO.APROVADA : null,
    comentario_lider: null,
    lider_em: liderJaAprovou ? agora : null,
    final_aprovador_id: aprovadores.final_aprovador_id,
    status_final: null,
    comentario_final: null,
    final_em: null,
  }
}

export function patchDecisaoLider(
  r: PresencaCulto,
  acao: 'APROVAR' | 'NEGAR' | 'DEVOLVER',
  comentario: string | null | undefined,
  agora: Date = new Date()
) {
  const coment = comentario ? String(comentario).trim() : null

  if (acao === 'APROVAR') {
    return { status_lider: DECISAO.APROVADA, comentario_lider: coment, lider_em: agora }
  }

  if (acao === 'NEGAR') {
    return {
      ...reverterParaOriginal(r),
      status_lider: DECISAO.NEGADA,
      comentario_lider: coment,
      lider_em: agora,
    }
  }

  // DEVOLVER: volta pra Falta limpa, com a segunda chance consumida.
  // A justificativa anterior fica no histórico.
  return {
    ...reverterParaOriginal(r),
    ...LIMPAR_JUSTIFICATIVA,
    segunda_chance: true,
  }
}

export function patchDecisaoFinal(
  r: PresencaCulto,
  acao: 'APROVAR' | 'NEGAR',
  comentario: string | null | undefined,
  agora: Date = new Date()
) {
  const coment = comentario ? String(comentario).trim() : null

  if (acao === 'APROVAR') {
    return {
      status: STATUS_PRESENCA.JUSTIFICADO,
      pontuacao: PONTUACAO_JUSTIFICADA,
      descontar_no_ranking: tipoDescontaNoRanking(r.tipo_justificativa ?? ''),
      status_final: DECISAO.APROVADA,
      comentario_final: coment,
      final_em: agora,
    }
  }

  return {
    ...reverterParaOriginal(r),
    status_final: DECISAO.NEGADA,
    comentario_final: coment,
    final_em: agora,
  }
}

// Ajuste manual do RH. O valor ajustado vira também o "original".
// Retorna o patch ou uma string com o erro.
export function patchAjusteManual(r: PresencaCulto, input: AjusteManualInput) {
  if (!input.comentario || !String(input.comentario).trim()) {
    return 'Informe o motivo do ajuste.'
  }

  let status = (input.status ?? r.status_original) as string
  let hora = input.hora !== undefined ? horaHHMM(input.hora) : horaHHMM(r.hora)

  if (input.hora && !horaValida(input.hora)) return 'Hora inválida. Use HH:MM.'

  if (status === STATUS_PRESENCA.FALTA) {
    hora = null
  } else {
    if (!hora) return 'Informe a hora de chegada.'
    // Se mandou hora sem status, o status sai da hora
    if (!input.status) status = statusPorHora(hora)
  }

  let pontuacao: number
  if (input.pontuacao !== undefined && input.pontuacao !== null) {
    pontuacao = Number(input.pontuacao)
    if (!Number.isInteger(pontuacao)) return 'Pontuação deve ser um número inteiro.'
  } else if (status === STATUS_PRESENCA.FALTA) {
    pontuacao = -1
  } else {
    pontuacao = pontuacaoPorHora(hora)
  }

  return {
    ...LIMPAR_JUSTIFICATIVA,
    status,
    hora,
    pontuacao,
    status_original: status,
    pontuacao_original: pontuacao,
    ajustado_manualmente: true,
  }
}

// =============================================================================
// Resumo, aproveitamento e ranking
// =============================================================================

// Dias do calendário que contam: dentro do período e até "hoje"
// (o app antigo contava dias futuros e o % começava o mês lá embaixo)
export function diasQueContam(calendario: string[], inicio: string, fim: string, hoje: string) {
  const limite = fim < hoje ? fim : hoje
  return calendario
    .map(paraDataISO)
    .filter((d) => d >= inicio && d <= limite)
    .sort()
}

export function calcularResumo(params: {
  userId: string
  registros: PresencaCulto[] // registros dessa pessoa (qualquer período)
  calendario: string[] // datas do calendário
  inicio: string
  fim: string
  hoje: string
}): ResumoPresenca {
  const dias = diasQueContam(params.calendario, params.inicio, params.fim, params.hoje)
  const diasSet = new Set(dias)

  const porDia = new Map<string, PresencaCulto>()
  for (const r of params.registros) {
    const d = paraDataISO(r.data)
    if (diasSet.has(d)) porDia.set(d, r)
  }

  let pontos = 0
  let diasDescontados = 0
  let pontuais = 0
  let presentes = 0
  let atrasos = 0
  let faltas = 0
  let emAprovacao = 0
  let justificados = 0
  let sequencia = 0
  let maiorSequencia = 0

  for (const d of dias) {
    const r = porDia.get(d)

    // Dia do calendário sem registro: conta como elegível sem pontos e quebra sequência
    if (!r) {
      sequencia = 0
      continue
    }

    // Dia neutro: sai do cálculo e não quebra a sequência
    if (r.descontar_no_ranking) {
      diasDescontados++
      justificados++
      continue
    }

    pontos += Number(r.pontuacao)

    switch (r.status) {
      case STATUS_PRESENCA.PRESENTE:
        presentes++
        break
      case STATUS_PRESENCA.ATRASO:
        atrasos++
        break
      case STATUS_PRESENCA.FALTA:
        faltas++
        break
      case STATUS_PRESENCA.EM_APROVACAO:
        emAprovacao++
        break
      case STATUS_PRESENCA.JUSTIFICADO:
        justificados++
        break
    }

    const pontual =
      (r.status === STATUS_PRESENCA.PRESENTE || r.status === STATUS_PRESENCA.ATRASO) &&
      chegouPontual(r.hora)

    if (pontual) {
      pontuais++
      sequencia++
      if (sequencia > maiorSequencia) maiorSequencia = sequencia
    } else {
      sequencia = 0
    }
  }

  const diasElegiveis = dias.length - diasDescontados
  const maximo = diasElegiveis * PONTOS_MAXIMOS_POR_DIA
  const aproveitamento = maximo > 0 ? Math.round((pontos / maximo) * 10000) / 100 : 0

  return {
    user_id: params.userId,
    data_inicio: params.inicio,
    data_fim: params.fim,
    pontos,
    maximo,
    dias_calendario: dias.length,
    dias_descontados: diasDescontados,
    dias_elegiveis: diasElegiveis,
    aproveitamento,
    pontuais,
    presentes,
    atrasos,
    faltas,
    em_aprovacao: emAprovacao,
    justificados,
    maior_sequencia_pontual: maiorSequencia,
    categoria: categoriaPorAproveitamento(aproveitamento),
  }
}

// Desempate: % > chegadas até 07:30 > maior sequência > menos faltas
export function compararRanking(a: ResumoPresenca, b: ResumoPresenca) {
  return (
    b.aproveitamento - a.aproveitamento ||
    b.pontuais - a.pontuais ||
    b.maior_sequencia_pontual - a.maior_sequencia_pontual ||
    a.faltas - b.faltas
  )
}

// Ordena e numera; empate total divide a mesma posição
export function montarRanking(itens: Omit<ItemRanking, 'posicao'>[]): ItemRanking[] {
  const ordenados = [...itens].sort(compararRanking)
  const resultado: ItemRanking[] = []

  ordenados.forEach((item, i) => {
    const anterior = resultado[i - 1]
    const empatado = anterior && compararRanking(anterior, item) === 0
    resultado.push({ ...item, posicao: empatado ? anterior.posicao : i + 1 })
  })

  return resultado
}