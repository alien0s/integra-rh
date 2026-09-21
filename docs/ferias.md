# Módulo de Férias / Folga

Solicitações de férias e folga do colaborador com **aprovação em duas etapas**
(gestor do setor → DP), cancelamento, lembretes de ciclo, calendário da equipe,
visão geral do DP/RH e limite por feriados. Tudo passa pela API e pelo Postgres.

---

## 1. Fluxo de aprovação (2 etapas)

```
PENDENTE ─(gestor do setor aprova)→ APROVADO_GESTOR ─(DP confirma)→ APROVADO
   │                                      │
   └─(gestor recusa + motivo)→ RECUSADO ←─(DP recusa + motivo)
PENDENTE | APROVADO_GESTOR ─(colaborador cancela)→ CANCELADO
APROVADO ─(DP/ADMIN cancela)→ CANCELADO
```

- O **gestor do setor** é `setor.gestor_id`. Ao criar, a solicitação é roteada
  ao gestor do setor do solicitante (notificação acionável).
- **Fallback**: se o setor não tem gestor, ou o solicitante É o gestor, a 1ª
  etapa é pulada — nasce em `APROVADO_GESTOR` e vai direto ao DP.
- **Cancelamento**: o colaborador dono cancela enquanto não confirmado
  (`PENDENTE`/`APROVADO_GESTOR`); depois de `APROVADO`, só DP/ADMIN.
- **Papéis** (catálogo `roles`): `GESTOR` (1ª etapa), `DP` (2ª etapa/confirma +
  gere feriados), `RH` (visão geral, leitura), `ADMIN` (tudo).

---

## 2. Tabela — `ferias_solicitacoes`

Migrations: [`008_ferias.sql`](../apps/api/db/migrations/008_ferias.sql) (base) +
[`014_ferias_fluxo_aprovacao.sql`](../apps/api/db/migrations/014_ferias_fluxo_aprovacao.sql) (2 etapas + cancelamento).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID FK users | quem solicitou (CASCADE) |
| `tipo` | `FERIAS` \| `FOLGA` | |
| `data_inicio` / `data_fim` | DATE | período (CHECK `fim >= inicio`) |
| `dias` | INTEGER | dias corridos (CHECK `> 0`) |
| `observacoes` | TEXT | mensagem ao gestor |
| `periodo_aquisitivo_inicio` / `_fim` | DATE | ciclo congelado (histórico) |
| `status` | `PENDENTE`\|`APROVADO_GESTOR`\|`APROVADO`\|`RECUSADO`\|`CANCELADO` | VARCHAR(20) |
| `aprovado_gestor_por` / `_em` | UUID FK users / TIMESTAMPTZ | **1ª etapa** (gestor) |
| `aprovado_por` / `decidido_em` | UUID FK users / TIMESTAMPTZ | **2ª etapa** (DP) |
| `confirmado` | BOOLEAN | TRUE quando o DP confirmou |
| `motivo_recusa` | TEXT | obrigatório se `RECUSADO` (CHECK) |
| `cancelado_por` / `_em` / `motivo_cancelamento` | UUID / TIMESTAMPTZ / TEXT | cancelamento |
| `origem` | `SOLICITACAO` \| `REGISTRO_MANUAL` | pedido normal vs lançamento do DP |
| `created_at` / `updated_at` | TIMESTAMPTZ | "solicitado em" / trigger |

`setor.gestor_id` (FK users) é adicionado na 014. Saldo **não** é coluna — é
calculado a partir das aprovadas + regra (30 dias/ciclo, `users.data_admissao`).

---

## 3. Backend

- **Lógica**: [`lib/ferias.ts`](../apps/api/src/lib/ferias.ts) — `criarSolicitacao`
  (roteia gestor/fallback, valida antecedência 40d + sexta/sáb/dom + feriado),
  `aprovarSolicitacao` (gestor), `confirmarSolicitacao` (DP), `recusarSolicitacao`,
  `cancelarSolicitacao`, `listSolicitacoes(gestorId?)` (gestor vê só o setor),
  `listSolicitacoesEquipe`, `listVisaoGeral(mes?)`, `avaliarLembreteCiclo`.
- **Guard**: [`plugins/auth.ts`](../apps/api/src/plugins/auth.ts) `exigirPapeis(...)`.
- **Rotas**: [`routes/ferias.routes.ts`](../apps/api/src/routes/ferias.routes.ts) (JWT):

| Método | Rota | Papel | Uso |
|---|---|---|---|
| GET | `/ferias` | não-colaborador | Visão geral (gestor filtrado ao setor) |
| GET | `/ferias/minhas` | qualquer | Histórico próprio |
| GET | `/ferias/resumo` | qualquer | Saldo (cards) |
| GET | `/ferias/equipe` | GESTOR | Férias da equipe (dialog) |
| GET | `/ferias/geral?mes=YYYY-MM` | DP/RH | Vão entrar / precisam tirar |
| POST | `/ferias` | qualquer | Nova solicitação → notifica gestor/DP |
| POST | `/ferias/registrar-manual` | DP/RH/ADMIN | Lançamento retroativo |
| PATCH | `/ferias/:id/aprovar` | GESTOR (do setor) | 1ª etapa |
| PATCH | `/ferias/:id/confirmar` | DP | 2ª etapa |
| PATCH | `/ferias/:id/recusar` | GESTOR/DP | com motivo obrigatório |
| PATCH | `/ferias/:id/cancelar` | dono / DP-ADMIN | conforme status |

**Notificações** ([`lib/notificacoes.ts`](../apps/api/src/lib/notificacoes.ts)):
criar → gestor (`*_SOLICITADA`, acionável); gestor aprova → DP (`FERIAS_AGUARDA_DP`,
acionável) + colaborador (informativa); DP confirma/recusa/cancela → colaborador.
O card acionável some quando a etapa muda (`acionavelPorEtapa`).

**Lembrete de ciclo**: `avaliarLembreteCiclo` roda em `GET /notificacoes` (ao abrir
o app). Se falta ≤60 dias pro fim do ciclo e não há pedido no ciclo, emite
`FERIAS_LEMBRETE_CICLO` — no máx. 1 a cada 30 dias.

---

## 4. Frontend

`features/ferias/{types,services,hooks,components}` + página
[`pages/ferias/FeriasList.tsx`](../apps/web/src/pages/ferias/FeriasList.tsx).

- **Colaborador**: `FeriasPessoal` (resumo + `NovaSolicitacaoForm` + `HistoricoSolicitacoes`).
  O formulário desabilita no calendário: fim de semana, sexta, < 40 dias e **feriados**.
  O histórico permite **cancelar** enquanto não confirmado.
- **Gestor**: `FeriasOverview` filtrado ao setor; botão **"Calendário da equipe"**
  (`EquipeCalendarDialog`); aprova/recusa (motivo obrigatório) no card.
- **DP/RH**: painel `VisaoGeralDpRh` (quem entra / precisa tirar, filtro por mês);
  DP **confirma** (`AGUARDANDO_DP`) e pode **cancelar** aprovadas. Aba **"Feriados"** (DP/ADMIN).
- **Progresso** de aprovação (gestor → DP, com quem/quando) no `FeriasRequestCard`.
- **Notificações**: `NotificacaoItem` — aprovar/confirmar conforme a etapa; recusa
  com motivo obrigatório.

---

## 5. A evoluir

- Agendador real (cron) para lembretes independentes de login (hoje é sob demanda).
- Saldo por múltiplos ciclos acumulados (hoje é só o ciclo vigente).
- Toggle de dia útil individual além de feriados.
