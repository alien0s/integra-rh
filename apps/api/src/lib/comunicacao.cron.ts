import cron from "node-cron";
import { encerrarVencidos } from "./comunicacao.js";

export function iniciarJobsComunicacao() {
  // Todo dia à 01:00 — encerra comunicados não-recorrentes cuja data_fim já passou.
  // Recorrentes não precisam de job: a visibilidade é calculada na hora
  // (bate o dia_semana com hoje?), então não expiram sozinhos.
  cron.schedule("0 1 * * *", async () => {
    try {
      const total = await encerrarVencidos();
      console.log(`[comunicacao] ${total} comunicado(s) encerrado(s) por vencimento`);
    } catch (err) {
      console.error("[comunicacao] erro ao encerrar vencidos:", err);
    }
  });
}