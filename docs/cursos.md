# Módulo de Cursos e Qualificações

Formação acadêmica, cursos/workshops/certificações e idiomas cadastrados pelo
próprio colaborador — sujeitos à **aprovação do RH** (aprovação de 1 etapa só,
sem gestor no meio). Cada formação/curso pode ter um anexo (diploma ou
certificado); idiomas não têm anexo. Tudo passa pela API e pelo Postgres.

---

## 1. Fluxo de aprovação (1 etapa — RH)

```
PENDENTE ─(RH/ADMIN aprova)→ APROVADO
PENDENTE ─(RH/ADMIN recusa + motivo)→ RECUSADO
```

- **Quem cadastra**: sempre o próprio colaborador (`request.user.id` como
  dono), nunca outra pessoa em nome dele.
- **Quem aprova**: só `RH`/`ADMIN` (`PAPEIS_RH`, checado manualmente em cada
  rota via `ehRh()` — este módulo não usa `exigirPapeis()` no `onRequest`,
  diferente de Férias/Tabelas/VR).
- **Regra de negócio importante**: o `status` (PENDENTE/APROVADO/RECUSADO) é
  só para a fila de moderação do RH — **o colaborador nunca vê esse status**
  na própria tela (ver comentário no topo da migration). No máximo, o front
  pode usar `status = 'APROVADO'` para um selo de "verificado".
- **O que o status controla de verdade**: enquanto não `APROVADO`, o registro
  não entra nem na visão de perfil de outra pessoa (`GET
  /qualificacoes/usuario/:id`) nem nos agregados da "Visão geral" (contagens,
  tabela de funcionários) — ver `listFormacoesAprovadas`/`listCursosAprovados`/
  `listIdiomasAprovados` e `getQualificacoesResumo`/`listFuncionariosComQualificacoes`,
  todos filtrados a `WHERE status = 'APROVADO'`. A própria aba "Pessoal" do
  colaborador sempre mostra os próprios registros, de qualquer status.
- **Idiomas são upsert**: reeditar um idioma já cadastrado (`UNIQUE(user_id,
  idioma)`) volta o `status` pra `PENDENTE` — precisa ser reaprovado.

---

## 2. Tabelas

Migration: [`013_qualificacoes.sql`](../apps/api/db/migrations/013_qualificacoes.sql).
As três tabelas repetem o mesmo bloco de aprovação (`status` +
`aprovado_por` + `decidido_em` + `motivo_recusa`, CHECK exigindo motivo
quando `RECUSADO`) — mesmo padrão de `ferias_solicitacoes`.

### `qualificacoes_academicas` (formação acadêmica)

| Coluna | Tipo | Observação |
|---|---|---|
| `nivel` | `TECNICO`\|`GRADUACAO`\|`POS_GRADUACAO`\|`MBA`\|`MESTRADO`\|`DOUTORADO` | |
| `curso` / `instituicao` | VARCHAR | |
| `ano_inicio` / `ano_fim` | SMALLINT | `ano_fim NULL` = ainda cursando |
| `situacao` | `EM_ANDAMENTO`\|`CONCLUIDO`\|`TRANCADO` | |
| `anexo_url` | TEXT | chave do storage — diploma/comprovante |

### `qualificacoes_cursos` (cursos + workshops + certificações)

| Coluna | Tipo | Observação |
|---|---|---|
| `tipo` | `CERTIFICACAO`\|`CURSO`\|`WORKSHOP` | define a seção no front |
| `nome` / `instituicao` | VARCHAR | |
| `carga_horaria` | SMALLINT | horas — geralmente só curso/workshop |
| `data_emissao` / `data_validade` | DATE | validade geralmente só certificação |
| `certificado_url` | TEXT | chave do storage — certificado |

### `qualificacoes_idiomas`

| Coluna | Tipo | Observação |
|---|---|---|
| `idioma` | VARCHAR | `UNIQUE(user_id, idioma)` |
| `nivel_cefr` | `A1`..`C2` | fonte única — rótulo/% derivados no front |
| `origem_avaliacao` | `AUTODECLARADO`\|`TESTE_INTERNO` | |
| `avaliado_em` | DATE | só quando `TESTE_INTERNO` |

Sem anexo — não há `anexo_url`/`certificado_url` nessa tabela.

---

## 3. Backend

- **Lógica**: [`lib/qualificacoes.ts`](../apps/api/src/lib/qualificacoes.ts) —
  `criarFormacao`/`criarCurso`/`criarOuAtualizarIdioma` (sempre `PENDENTE`),
  `aprovar*`/`recusar*` (por tabela), `listFormacoesPendentes`/`listCursosPendentes`/
  `listIdiomasPendentes` (fila de moderação — endpoint existe, sem tela
  dedicada no front hoje, ver §5), `listFormacoesAprovadas`/`listCursosAprovados`/
  `listIdiomasAprovados` (visão pública, sempre `APROVADO`, sem o campo
  `status`/`motivoRecusa` no DTO), `getQualificacoesResumo`/
  `listFuncionariosComQualificacoes` (agregados da Visão geral).
- **Anexo**: não usa `routes/uploads.routes.ts` — sobe direto via
  [`lib/storage.ts`](../apps/api/src/lib/storage.ts) (`uploadObject`/
  `getObjectStream`/`deleteObject`), chave
  `qualificacoes/{formacoes|cursos}/{id}/{uuid}{ext}`. Mimetypes aceitos:
  JPEG/PNG/WebP/PDF (`TIPOS_ANEXO_PERMITIDOS`).
- **Rotas**: [`routes/qualificacoes.routes.ts`](../apps/api/src/routes/qualificacoes.routes.ts):

| Método | Rota | Quem | Uso |
|---|---|---|---|
| GET | `/qualificacoes/minhas` | qualquer | Próprios registros (qualquer status) |
| GET | `/qualificacoes/usuario/:id` | qualquer | Registros aprovados de alguém (perfil) |
| GET | `/qualificacoes/resumo` | qualquer | Cards agregados (Visão geral) |
| GET | `/qualificacoes/funcionarios` | qualquer | Tabela da Visão geral |
| GET | `/qualificacoes/pendentes` | RH/ADMIN | Fila de moderação (sem tela no front ainda) |
| POST | `/qualificacoes/{formacoes,cursos,idiomas}` | qualquer | Cadastra como `PENDENTE` → notifica RH |
| PATCH | `.../:id/aprovar` | RH/ADMIN | Aprova |
| PATCH | `.../:id/recusar` | RH/ADMIN | Recusa (motivo obrigatório) |
| POST/GET/DELETE | `.../formacoes/:id/anexo`, `.../cursos/:id/anexo` | dono, RH/ADMIN, ou qualquer se já `APROVADO` | Diploma/certificado |
| DELETE | `/qualificacoes/{formacoes,cursos,idiomas}/:id` | dono ou RH/ADMIN | Exclui |

**Notificações** ([`lib/notificacoes.ts`](../apps/api/src/lib/notificacoes.ts)):
ao cadastrar, `emitirParaPapeis(["RH"], {..., requerAcao: true})` — o card é
**acionável** (Aprovar/Recusar direto na notificação, mesmo padrão de
Férias). `acionavelPorEtapa` resolve o status atual das 3 tabelas via LEFT
JOIN (`qualificacoes_academicas`/`qualificacoes_cursos`/`qualificacoes_idiomas`)
e só mantém os botões enquanto `PENDENTE` — o card some pra todo mundo do RH
assim que qualquer um decide (fila compartilhada, igual férias). A
notificação também carrega `temArquivo` (formação/curso com anexo — idiomas
nunca) pra o front oferecer um link **"Ver arquivo"** antes de decidir.

---

## 4. Frontend

`features/cursos/{types,services,hooks,components}` + página
[`pages/cursos/...`](../apps/web/src/features/cursos/components/CursosOverview.tsx).

- **Cadastro** (colaborador): `NewGraduacaoModal.tsx`, `NewCursoModal.tsx`,
  `NewIdiomaModal.tsx` — cada um avisa por toast que "entra como pendente até
  o RH aprovar".
- **Exibição**: `FormacaoAcademica.tsx`, `Certificacoes.tsx`,
  `CursosWorkshops.tsx`, `Idiomas.tsx` — reusados tanto na aba "Pessoal"
  (próprios registros, qualquer status) quanto na visão de perfil de
  outra pessoa (via `FuncionariosCursosSuperioresTable.tsx`, só aprovados,
  `hideAddButton`).
- **Aprovação — direto na notificação** (`NotificacaoItem.tsx`/
  `NotificacaoActionToast.tsx`): o card mostra Aprovar/Recusar (motivo
  obrigatório na recusa, mesmo padrão de férias) e, quando há anexo, um
  link **"Ver arquivo"** (`features/notificacoes/lib/anexoNotificacao.ts`)
  que baixa e abre o diploma/certificado numa nova aba antes de decidir.
  A decisão em si chama `cursosService.aprovar*/recusar*`
  (`useNotificacoes.ts`, `agirNaReferencia`).
- **Sem tela de moderação dedicada** — a aprovação acontece só via
  notificação (ver §5 pra evoluir isso, se um dia for preciso rever tudo
  pendente de uma vez).

---

## 5. A evoluir

- **Tela de moderação dedicada** (fila de pendências) consumindo `GET
  /qualificacoes/pendentes` — hoje esse endpoint existe no backend mas não é
  usado por nada no front; a aprovação só acontece reagindo a cada
  notificação individual, uma de cada vez.
- **Padronizar o guard de papel**: `qualificacoes.routes.ts` checa `ehRh()`
  manualmente em cada handler, em vez de usar `exigirPapeis()` no
  `onRequest` como os outros módulos (Férias, Tabelas, VR) — funciona igual,
  mas é uma inconsistência de estilo.
- Idiomas nunca têm anexo — se um dia precisar (ex.: certificado de proficiência
  como TOEFL/IELTS), a tabela precisaria de uma coluna nova.
