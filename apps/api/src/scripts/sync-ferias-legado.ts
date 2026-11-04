import { getDatabase, rodaComoUsuario } from '../lib/database.js';
import { sincronizarFeriasLegado, type ResultadoSincronizacaoFerias } from '../lib/ferias.js';
import { getApiConfig } from '../plugins/env.js';

/**
 * APS somente leitura → último período de férias encerrado por pessoa.
 * --todos ou --user=<uuid>; simulação por padrão, --aplicar persiste.
 * Não exclui históricos. Uma transação por pessoa; erros são contados.
 */
const ator = { id: '00000000-0000-0000-0000-000000000000', papelCodigo: 'ADMIN' };
class SimulacaoConcluida extends Error {
  constructor(readonly resultado: ResultadoSincronizacaoFerias) { super('Simulação concluída'); }
}

async function main() {
  if (!getApiConfig().mssql.enabled) throw new Error('Integração com APS desabilitada.');
  const todos = process.argv.includes('--todos');
  const userId = process.argv.find(arg => arg.startsWith('--user='))?.slice(7);
  const aplicar = process.argv.includes('--aplicar') || process.argv.includes('--manter');
  if (todos === Boolean(userId)) throw new Error('Informe --todos ou --user=<uuid>.');
  const usuarios = await rodaComoUsuario(ator, () => getDatabase()<{ id: string }[]>`
    SELECT id FROM users
    WHERE regexp_replace(COALESCE(cpf, ''), '[^0-9]', '', 'g') ~ '^[0-9]{11}$'
      AND ${userId ? getDatabase()`id = ${userId}::uuid` : getDatabase()`is_active = TRUE`}
    ORDER BY id
  `);
  const totais = { pessoas: usuarios.length, inseridos: 0, atualizados: 0, ignorados: 0, erros: 0 };
  console.log(aplicar ? 'Sincronização: persistindo o último período passado por pessoa.' : 'Simulação: nenhuma alteração será persistida.');
  for (let i = 0; i < usuarios.length; i++) {
    try {
      let resultado: ResultadoSincronizacaoFerias;
      try {
        resultado = await rodaComoUsuario(ator, async () => {
          const r = await sincronizarFeriasLegado(usuarios[i].id);
          if (!aplicar) throw new SimulacaoConcluida(r);
          return r;
        });
      } catch (error) {
        if (!(error instanceof SimulacaoConcluida)) throw error;
        resultado = error.resultado;
      }
      totais.inseridos += resultado.inseridos;
      totais.atualizados += resultado.atualizados;
      totais.ignorados += resultado.ignorados;
    } catch (error) {
      totais.erros++;
      console.error(`Falha na pessoa ${i + 1}/${usuarios.length}:`, error instanceof Error ? error.message : 'erro desconhecido');
    }
    if ((i + 1) % 10 === 0 || i + 1 === usuarios.length) console.log(`Processadas ${i + 1}/${usuarios.length}.`);
  }
  console.log(JSON.stringify(totais));
  if (totais.erros) process.exitCode = 1;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Falha na sincronização.');
  process.exitCode = 1;
}).finally(async () => {
  await getDatabase().end();
  // O pool de leitura do SQL Server mantém conexões abertas até sair.
  process.exit(process.exitCode ?? 0);
});
