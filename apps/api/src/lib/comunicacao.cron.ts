import cron from "node-cron";
import { encerrarVencidos } from "./comunicacao.js";
import { rodaComoUsuario } from "./database.js";

/**
 * Identidade "de sistema" pro job rodar com RLS ligado em `comunicados`
 * (ver a seção de Row Level Security no final de db/migrations/022_comunicacao.sql)
 * — ele roda fora de uma requisição HTTP, então não tem usuário autenticado
 * de verdade. `papelCodigo: "ADMIN"` dá acesso total, mesma convenção usada
 * em toda a aplicação (ver script test-vr.ts).
 */
const USUARIO_SISTEMA = { id: "cron:comunicacao", papelCodigo: "ADMIN" };

export function iniciarJobsComunicacao() {
  // Todo dia à 01:00 — encerra comunicados não-recorrentes cuja data_fim já passou.
  // Recorrentes não precisam de job: a visibilidade é calculada na hora
  // (bate o dia_semana com hoje?), então não expiram sozinhos.
  cron.schedule("0 1 * * *", async () => {
    try {
      const total = await rodaComoUsuario(USUARIO_SISTEMA, encerrarVencidos);
      console.log(`[comunicacao] ${total} comunicado(s) encerrado(s) por vencimento`);
    } catch (err) {
      console.error("[comunicacao] erro ao encerrar vencidos:", err);
    }
  });
}