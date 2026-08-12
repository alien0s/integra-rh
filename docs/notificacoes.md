# Módulo de Notificações

Caixa de entrada por usuário ("inbox"). Toda ação relevante (ex.: solicitação de
férias) notifica quem precisa — o RH, e o colaborador de volta na decisão.

---

## 1. Tabela — `notificacoes`

Migration: [`009_notificacoes.sql`](../apps/api/db/migrations/009_notificacoes.sql).
Modelo **fan-out**: uma linha por destinatário.

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | UUID | PK |
| `destinatario_id` | UUID FK users | quem **recebe** (uma linha por pessoa) |
| `ator_id` | UUID FK users | quem **fez** a ação (nome/avatar via JOIN); null = sistema |
| `tipo` | VARCHAR | ex.: `FERIAS_SOLICITADA`, `FERIAS_APROVADA` |
| `acao` / `detalhe` | TEXT | texto **congelado** no momento do evento |
| `referencia_tabela` / `referencia_id` | VARCHAR / UUID | ponteiro para o recurso de origem |
| `requer_acao` | BOOLEAN | mostra Aprovar/Recusar no card |
| `lida` / `lida_em` | BOOLEAN / TIMESTAMPTZ | leitura por destinatário |
| `created_at` | TIMESTAMPTZ | base do "tempo" relativo ("2 min") |

**Princípio-chave**: a notificação **não é a fonte da verdade**. Para as acionáveis
(ex.: aprovar férias), o **status/ação atuais vêm da tabela de origem** via
`referencia_*` (JOIN). Se a solicitação já foi decidida, o card **esconde os botões**.

---

## 2. Backend

- **Lógica**: [`lib/notificacoes.ts`](../apps/api/src/lib/notificacoes.ts)
  - `emitirParaUsuario(destinatarioId, evento)` — 1 destinatário.
  - `emitirParaPapeis(['RH'], evento)` — fan-out para todos os usuários de um papel (exclui o próprio ator).
  - `listNotificacoes(destinatarioId)` — resolve ator por JOIN, calcula "tempo" relativo, e para acionáveis faz JOIN com `ferias_solicitacoes` para saber se ainda está pendente.
  - `contarNaoLidas`, `marcarLida`, `marcarTodasLidas`.
- **Rotas**: [`routes/notificacoes.routes.ts`](../apps/api/src/routes/notificacoes.routes.ts) (JWT; sempre o `request.user`):

| Método | Rota | Uso |
|---|---|---|
| GET | `/notificacoes` | feed do logado (+ `naoLidas` para o badge) |
| PATCH | `/notificacoes/:id/lida` | marca uma como lida |
| POST | `/notificacoes/marcar-todas-lidas` | marca todas |

### Como uma ação emite notificação
Dentro do service da ação (ex.: rota de férias):
```ts
await emitirParaPapeis(["RH"], {
  atorId: request.user.id,
  tipo: "FERIAS_SOLICITADA",
  acao: "solicitou férias",
  detalhe: criada.periodo,
  referenciaTabela: "ferias_solicitacoes",
  referenciaId: criada.id,
  requerAcao: true,
});
```

---

## 3. Front

`apps/web/src/features/notificacoes/`:
- **Service**: `services/notificacoesService.ts` (getNotificacoes / marcarLida / marcarTodasLidas). Resolve avatar (`/api`).
- **Hook**: `useNotificacoes` — lista, contagem de não-lidas, marcar todas, e `aprovar`/`recusar` que **agem no recurso de origem** (chama o `feriasService` via `referenciaId`) e recarregam.
- **Componentes**: `NotificacoesDrawer` (sino + drawer) e `NotificacaoItem` (linha + cartão acionável).

---

## 4. Alvo do "RH"

Hoje o fan-out mira o papel **`RH`** (`emitirParaPapeis(['RH'], ...)`). Para incluir
DP/Gestor/Diretoria, basta passar mais códigos de papel. Modelo escolhido: **fan-out
por usuário** (leitura individual sai de graça) — bom para times pequenos.

## 5. A evoluir

- **Realtime/badge**: hoje o feed carrega ao abrir o drawer; dá para adicionar polling ou SSE/WebSocket.
- **Deep-link**: o `referencia_*` permite abrir o recurso (ex.: ir pra `/ferias`) ao clicar — ainda não ligado.
- **Recusar pela notificação** usa motivo genérico; a justificativa detalhada fica na tela de Férias.
