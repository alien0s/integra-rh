# Módulo de Férias / Folga

Solicitações de férias e folga do colaborador, com aprovação/recusa pelo gestor/RH.
Substitui o mock antigo — agora tudo passa pela API e pelo Postgres.

---

## 1. Tabela — `ferias_solicitacoes`

Migration: [`008_ferias.sql`](../apps/api/db/migrations/008_ferias.sql). Uma linha = uma solicitação.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID FK users | quem solicitou (ON DELETE CASCADE) |
| `tipo` | `FERIAS` \| `FOLGA` | as duas abas do formulário |
| `data_inicio` / `data_fim` | DATE | período (CHECK `fim >= inicio`) |
| `dias` | INTEGER | dias corridos (CHECK `> 0`) |
| `abono` | BOOLEAN | abono pecuniário (só férias) |
| `observacoes` | TEXT | mensagem ao gestor |
| `periodo_aquisitivo_inicio` / `_fim` | DATE | ciclo congelado (histórico) |
| `status` | `PENDENTE` \| `APROVADO` \| `RECUSADO` | |
| `aprovado_por` | UUID FK users | quem decidiu (nome via JOIN) |
| `decidido_em` | TIMESTAMPTZ | quando decidiu |
| `confirmado` | BOOLEAN | confirmação/efetivação |
| `motivo_recusa` | TEXT | obrigatório se `RECUSADO` (CHECK) |
| `created_at` / `updated_at` | TIMESTAMPTZ | "solicitado em" / trigger de update |

**Saldo NÃO é coluna** — é calculado a partir das solicitações aprovadas + regra (30 dias/ciclo).

---

## 2. Backend

- **Lógica**: [`lib/ferias.ts`](../apps/api/src/lib/ferias.ts) — formatação pt-BR (período, ciclo), mapeamento de status (DB→front), cálculo de saldo/ciclo aquisitivo (a partir de `users.data_admissao`).
- **Rotas**: [`routes/ferias.routes.ts`](../apps/api/src/routes/ferias.routes.ts) (todas exigem JWT):

| Método | Rota | Uso |
|---|---|---|
| GET | `/ferias` | Visão geral — todas as solicitações |
| GET | `/ferias/minhas` | histórico do colaborador logado |
| GET | `/ferias/resumo` | cards do topo (saldo + período aquisitivo) |
| POST | `/ferias` | criar solicitação `{tipo, dataInicio, dataFim, abono, observacoes}` |
| PATCH | `/ferias/:id/aprovar` | aprova (status `PENDENTE` → `APROVADO`) |
| PATCH | `/ferias/:id/recusar` | recusa `{motivo}` |

Cada ação **emite notificação** (ver [notificacoes.md](./notificacoes.md)):
- **criar** → notifica o **RH** (acionável: Aprovar/Recusar no card).
- **aprovar/recusar** → notifica o **colaborador** (informativa).

---

## 3. Front

`apps/web/src/features/ferias/`:
- **Service**: `services/feriasService.ts` (getSolicitacoes / getMinhas / getResumo / criar / aprovar / recusar). Resolve o avatar (`/api` + caminho).
- **Hooks**: `useFerias` (Visão geral: lista + aprovar/recusar) e `useFeriasPessoal` (resumo + histórico + solicitar).
- **Componentes**: `FeriasOverview` (cards + filtro), `FeriasPessoal` (resumo + form + histórico), `NovaSolicitacaoForm` (calendário; envia via `onSolicitar`).

Fluxo: **Página → Hook → Service → API** (padrão da skill de estrutura).

---

## 4. A evoluir (pós-MVP)

- **Saldo**: hoje `diasRestantes` na Visão geral é aproximado (`30 - dias do pedido`) e o resumo considera só férias **aprovadas futuras**. Refinar conforme a regra real (afastamentos, período concessivo, faltas).
- **Limite/validações** (30 dias, início não em fim de semana) são regra de negócio no front; podem migrar para o backend.
- **Recusar via notificação** envia um motivo genérico — a justificativa detalhada é feita na tela de Férias.
