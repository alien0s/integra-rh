# Módulo de Feriados

Mapa de feriados definido pelo **DP**, usado para limitar o calendário de
solicitação de férias: o início das férias não pode cair num feriado (além de
sexta/sábado/domingo). "Dias úteis" são **derivados** (todo dia que não é fim de
semana nem feriado) — não guardamos uma linha por dia do ano.

---

## 1. Tabela — `feriados`

Migration: [`015_feriados.sql`](../apps/api/db/migrations/015_feriados.sql).

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | UUID | PK |
| `data` | DATE **UNIQUE** | idempotência da importação |
| `nome` | VARCHAR(120) | ex.: "Independência do Brasil" |
| `tipo` | `NACIONAL`\|`ESTADUAL`\|`MUNICIPAL`\|`FACULTATIVO` | CHECK |
| `ano` | INTEGER | derivado de `data` (facilita filtro) |
| `fonte` | `MANUAL` \| `BRASILAPI` | origem do registro |
| `created_at` / `updated_at` | TIMESTAMPTZ | trigger de update |

---

## 2. Backend

- **Lógica**: [`lib/feriados.ts`](../apps/api/src/lib/feriados.ts) — `listFeriados(ano?)`,
  `criarFeriado`, `atualizarFeriado`, `excluirFeriado`, `importarFeriadosNacionais(ano)`.
- **Importação**: `GET https://brasilapi.com.br/api/feriados/v1/{ano}` (grátis, sem
  chave), com timeout de 10s e `ON CONFLICT (data) DO NOTHING`. Degrada com erro
  amigável (`FeriadoInvalidoError`) se a API cair.
- **Rotas**: [`routes/feriados.routes.ts`](../apps/api/src/routes/feriados.routes.ts):

| Método | Rota | Papel | Uso |
|---|---|---|---|
| GET | `/feriados?ano=` | qualquer autenticado | calendário de férias lê daqui |
| POST | `/feriados` | DP/ADMIN | cadastro manual |
| PATCH | `/feriados/:id` | DP/ADMIN | edição |
| DELETE | `/feriados/:id` | DP/ADMIN | exclusão |
| POST | `/feriados/importar` `{ano}` | DP/ADMIN | importa nacionais (BrasilAPI) |

A validação do início das férias contra feriado é feita no backend
(`validarInicioNaoFeriado`, em `lib/ferias.ts`) — o front apenas espelha para a UX.

---

## 3. Frontend

Feature nova `features/feriados/{types,services,hooks,components}`:

- `feriadosService` — CRUD + `importar(ano)`.
- `useFeriados(ano)` — lista/CRUD/importa; recarrega ao trocar de ano.
- `FeriadosAdmin` — tela do DP (aba **"Feriados"** em `/ferias`): seletor de ano,
  botão **"Importar nacionais de {ano}"** e a tabela inline-editável (reusa
  `RegistrosCard` das Tabelas). Feriados importados ganham a badge "BrasilAPI".
- `NovaSolicitacaoForm` busca os feriados do ano atual + próximo e os desabilita
  no calendário (matcher `disabled`) além de bloquear o início no envio.

---

## 4. A evoluir

- Feriados recorrentes automáticos (ex.: fixos) sem re-importar por ano.
- Escopo estadual/municipal por entidade/cidade do colaborador.
