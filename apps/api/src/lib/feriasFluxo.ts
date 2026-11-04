import type postgres from 'postgres';

/** Etapas gerais; Coord. DP possui somente a exceção de chefia direta na 1ª etapa. */
export const PAPEL_POR_ETAPA = {
  PENDENTE: 'GESTOR',
  APROVADO_GESTOR: 'RH',
  APROVADO_RH: 'ASSISTENTE',
} as const;

export type StatusEtapaFerias = keyof typeof PAPEL_POR_ETAPA;

export function ehEtapaDecisao(status: string): status is StatusEtapaFerias {
  return Object.hasOwn(PAPEL_POR_ETAPA, status);
}

/** ADMIN/dev podem operar a etapa atual; ninguém pode pular uma etapa. */
export function podeDecidirEtapa(
  papel: string | undefined,
  status: StatusEtapaFerias,
  ehResponsavelPrimeiraEtapa = false,
): boolean {
  return papel === undefined || papel === 'ADMIN' || papel === PAPEL_POR_ETAPA[status] ||
    (papel === 'COORDENADOR DP' && status === 'PENDENTE' && ehResponsavelPrimeiraEtapa);
}

/**
 * Chefia exclusivamente por setor (mesma regra no RLS 035).
 * DP: Coord. DP ativo de setor.manager_id tem prioridade. Demais casos
 * usam o GESTOR ativo de setor.gestor_id; sem chefia elegível, vão ao RH.
 * to_jsonb mantém leituras compatíveis durante a aplicação da migration 035.
 */
export function responsavelPrimeiraEtapaSql(sql: ReturnType<typeof postgres>) {
  return sql`COALESCE(
    (SELECT c.id FROM setor s JOIN users c ON c.id = (to_jsonb(s)->>'manager_id')::uuid
     JOIN roles rc ON rc.id = c.role_id
     WHERE s.id = u.setor_id AND c.is_active = TRUE AND c.id <> u.id
       AND rc.codigo = 'COORDENADOR DP'
       AND u.role_id = (SELECT id FROM roles WHERE codigo = 'DP')),
    (SELECT g.id FROM setor s JOIN users g ON g.id = s.gestor_id
     JOIN roles rg ON rg.id = g.role_id
     WHERE s.id = u.setor_id AND g.is_active = TRUE AND g.id <> u.id
       AND rg.codigo = 'GESTOR')
  )`;
}

/** RH solicitante não revisa o próprio pedido; após a chefia, segue ao Assistente. */
export function statusAposChefiaSql(sql: ReturnType<typeof postgres>) {
  return sql`CASE WHEN u.role_id = (SELECT id FROM roles WHERE codigo = 'RH')
    THEN 'APROVADO_RH' ELSE 'APROVADO_GESTOR' END`;
}
