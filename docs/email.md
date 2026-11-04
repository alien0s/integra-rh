# E-mail de Saída (SMTP)

Documentação do envio de e-mail do ERP (hoje: aviso ao colaborador quando o DP confirma
as férias; a infra é genérica pra qualquer feature futura reusar). Feito para os
próximos programadores entenderem **o que é**, **como configurar** e **como o fluxo
funciona**.

---

## 1. O que é

O ERP manda e-mail de verdade (não só o sininho de notificação dentro do app) usando um
servidor **SMTP corporativo** — não é um serviço terceiro tipo SendGrid/Resend contratado
por este projeto. `SMTP_HOST` aponta pra um **gateway/relay interno** (Postfix, mantido
pelo TI da instituição, domínio `adventistas.org` — mesma organização dona do AD/LDAP
já usado pro login, ver o bloco `ldap` em `env.ts`) — a API só se autentica numa conta de
serviço (`noreply@...`) e manda por ele.

Esse gateway não é o destino final: a caixa de e-mail de verdade é hospedada no
**Microsoft 365 / Exchange Online** (confirmado via DNS — `autodiscover.adventistas.org`
é CNAME de `autodiscover.outlook.com`, e as chaves DKIM do domínio apontam pro tenant
`mailadventistas.onmicrosoft.com`). Ou seja: Postfix interno → Microsoft 365 → caixa de
entrada do destinatário. Nada disso é hospedado na infraestrutura do ERP.

É a **primeira e única** integração de e-mail de saída do sistema até agora — nenhum outro
fluxo manda e-mail hoje, só notificação in-app (ver [`docs/notificacoes.md`](./notificacoes.md)).

Analogia rápida com o storage de arquivos ([`docs/minio-storage.md`](./minio-storage.md)):
assim como a API nunca expõe o MinIO direto pro navegador, ela também é a única que fala
com o servidor SMTP — o front só dispara a ação (ex.: "confirmar férias"), quem manda o
e-mail é sempre o backend.

---

## 2. Configuração (`.env` da raiz)

```bash
SMTP_ENABLED=true              # false (padrão) = recurso desligado, não tenta conectar
SMTP_HOST=                     # host do servidor SMTP corporativo
SMTP_PORT=587                  # STARTTLS (não é a porta 465/implícita)
SMTP_USER=                     # conta de serviço usada pra autenticar (ex.: noreply@...)
SMTP_FROM="IntegraRH <noreply@...>"   # remetente exibido — aspas são necessárias
                                       # por causa do espaço e dos "<>" (ver nota abaixo)
PASSWORD_EMAIL=                # senha da conta de serviço (nome histórico, não SMTP_PASSWORD)

# URL usada pra montar o link que vai DENTRO do corpo do e-mail (ex.:
# "veja os detalhes em <APP_URL>/ferias"). Separada de FRONTEND_URL de
# propósito: FRONTEND_URL também controla CORS e o redirect do login
# Microsoft, então não pode virar a URL de produção sem quebrar o dev local.
# Se o domínio de produção mudar um dia, troque só aqui.
APP_URL=https://integra.aceam.org.br
```

Lidas em [`apps/api/src/plugins/env.ts`](../apps/api/src/plugins/env.ts) via
`getApiConfig().smtp` (nunca ler `process.env` direto fora daí) — mesmo padrão do bloco
`mssql` (porta `enabled` liga/desliga o recurso inteiro).

**Nota sobre `SMTP_FROM`**: o parser de `.env` (tanto o `--env-file` nativo do Node quanto
o `dotenv`) só preserva espaços/`<`/`>` se o valor inteiro estiver entre aspas duplas. Sem
aspas, `IntegraRH <noreply@...>` pode ser cortado ou interpretado errado — sempre envolva
com `"..."`.

**Nota sobre `PASSWORD_EMAIL`**: o nome dessa variável é uma exceção à convenção
`SMTP_*` do resto do bloco — foi mantido assim porque já existia no `.env` antes da
variável `SMTP_*` ser criada. Não renomeie sem atualizar `env.ts` junto.

---

## 3. Como o fluxo funciona

```
PATCH /ferias/:id/confirmar  (Tesoureiro Assistente confirma — 3ª e última etapa, após o RH)
  → confirmarSolicitacao()      grava status=APROVADO no Postgres
  → emitirParaUsuario(...)      notificação in-app (sininho) — já existia antes
  → enviarEmail(...)            manda o e-mail de verdade (texto + HTML)
```

`enviarEmail` ([`apps/api/src/lib/email.ts`](../apps/api/src/lib/email.ts)) é **"best
effort"**: nunca lança exceção. Se o SMTP estiver fora do ar, com credencial errada, ou
`SMTP_ENABLED=false`, a função só loga (`console.error`/`console.log`) e retorna — a
confirmação da solicitação **já foi salva no banco antes** dessa chamada, então uma falha
de e-mail nunca desfaz nem bloqueia a ação do Tesoureiro Assistente.

Texto do e-mail usa os mesmos dados já calculados pra notificação in-app
(`getSolicitacaoParaNotificar` em [`lib/ferias.ts`](../apps/api/src/lib/ferias.ts)) —
nome do colaborador, período formatado e quantidade de dias.

**Cabeçalho padrão (todo e-mail) e selo por tipo**: `enviarEmail` sempre manda os dois
formatos — `text` (fallback puro) e `html`. O HTML é montado automaticamente por
`montarHtmlEmail` (interno a `lib/email.ts`): cabeçalho com o logo (quadrado azul + ícone
de folha, mesmo SVG do ícone "Leaf" do lucide-react usado em `AppLogo.tsx`) + "IntegraRH",
seguido do próprio `texto` convertido em parágrafos (URLs viram link clicável). Quem chama
`enviarEmail` nunca precisa montar esse cabeçalho — só passa `texto` como sempre. Um
`destaqueHtml` opcional insere um bloco extra entre o cabeçalho e o texto — no e-mail de
férias é o ícone de coqueiro (verde, mesmo path do "Palmtree" do lucide-react) + o título
"Férias confirmadas" (montado em `ferias.routes.ts`, constante `DESTAQUE_FERIAS_CONFIRMADAS_HTML`).

Os ícones vão como `<svg>` inline (não imagem/anexo): um `cid` ou `data:` URI não renderiza
no Outlook clássico (motor Word), mas inline funciona nos clientes modernos (Gmail, Apple
Mail, Outlook novo/web, apps mobile) — na pior hipótese, some só o desenho; o quadrado
colorido e o texto continuam aparecendo. Layout em tabelas + estilo inline de propósito —
é o que esses clientes corporativos interpretam de forma previsível (ignoram `<style>` e
boa parte do CSS moderno).

---

## 4. Onde está no código

| Arquivo | Papel |
|---|---|
| [`apps/api/src/lib/email.ts`](../apps/api/src/lib/email.ts) | `enviarEmail()` — transporte SMTP (nodemailer), genérico |
| [`apps/api/src/plugins/env.ts`](../apps/api/src/plugins/env.ts) | Config `smtp` (vars `SMTP_*` + `PASSWORD_EMAIL`) |
| [`apps/api/src/lib/ferias.ts`](../apps/api/src/lib/ferias.ts) | `SELECT_SOLICITACAO`/`getSolicitacaoParaNotificar` — agora também trazem o e-mail do colaborador |
| [`apps/api/src/routes/ferias.routes.ts`](../apps/api/src/routes/ferias.routes.ts) | Gatilho: `PATCH /ferias/:id/confirmar`, logo após a notificação in-app |

A lib usa `nodemailer` (+ `@types/nodemailer`), único pacote novo adicionado pra isso.

---

## 5. Boas práticas / produção

- **Nunca** chame `nodemailer`/o transporter fora de `lib/email.ts` — outras features que
  precisarem mandar e-mail devem reusar `enviarEmail()`, não montar um transporter novo.
- **Sem conceito de opt-out** hoje: todo e-mail disparado é enviado sempre, sem checar
  preferência do destinatário — mesmo comportamento das notificações in-app já existentes
  (nenhuma das duas tem "silenciar notificações" ainda).
- **Credencial**: fica só em `PASSWORD_EMAIL` no `.env` do servidor — nunca comitar no Git,
  nunca colar em chat/PR. Se precisar trocar a senha, só atualizar o `.env` e reiniciar a API
  (`pm2 restart integra-api` em produção) — nenhum outro lugar guarda uma cópia dela.
- **Novo tipo de e-mail**: chame `enviarEmail({ para, assunto, texto })` de onde fizer
  sentido (igual o padrão de `emitirParaUsuario`/`emitirParaPapeis` pras notificações
  in-app) — não precisa mexer em `lib/email.ts` pra isso, só no ponto de disparo. O
  cabeçalho (logo + "IntegraRH") sai de graça, sempre; se o tipo de e-mail quiser um selo
  próprio (ícone + título, como o de férias), monte o HTML no arquivo de rotas e passe em
  `destaqueHtml`.

---

## 6. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Log: `[email] SMTP desabilitado — envio pulado` | `SMTP_ENABLED` não é `true` | Conferir `.env` e reiniciar a API |
| Log: `[email] falha ao enviar pra ...: Error: Invalid login` | `SMTP_USER`/`PASSWORD_EMAIL` errados | Confirmar credencial com o TI |
| Log: `[email] falha ao enviar pra ...` com erro de conexão/timeout | Host/porta errados, ou rede bloqueando a porta 587 | Testar conectividade (`telnet <host> 587` ou similar) a partir do servidor da API |
| E-mail não chega mas não há erro no log | Caiu em spam, ou a caixa do destinatário tem regra de filtro | Verificar spam; conferir com o TI se o domínio tem SPF/DKIM configurado pro remetente `noreply@...` |
| Confirmação de férias falha com erro 500 | **Não deveria acontecer por causa do e-mail** — `enviarEmail` nunca lança. Se acontecer, o bug está em outro lugar do handler, não aqui | Olhar o stack trace completo no log da API |
