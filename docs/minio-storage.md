# Storage de Arquivos — MinIO (S3)

Documentação do armazenamento de arquivos do ERP (fotos de avatar hoje; documentos no futuro).
Feito para os próximos programadores entenderem **o que é**, **como rodar** e **como o fluxo funciona**.

---

## 1. O que é

Os arquivos **não ficam no código nem no Postgres** — ficam no **MinIO**, um servidor de
_object storage_ **compatível com a API do S3** (Amazon). Ele roda como um container Docker
na VPS. No banco guardamos só a **referência** (a "chave" do objeto), nunca o arquivo.

Analogia rápida:
- **Código** = a aplicação.
- **PostgreSQL** = as fichas/dados (texto).
- **MinIO** = o depósito de arquivos (fotos/documentos).

---

## 2. Como rodar (dev / VPS)

O container é definido em [`docker-compose.minio.yml`](../docker-compose.minio.yml) (raiz do projeto).

```bash
# a partir da raiz do projeto
docker compose -f docker-compose.minio.yml up -d

docker ps            # deve listar "erp-minio" como healthy
```

- **API S3** (usada pela API do ERP): `http://localhost:9000`
- **Console web** (navegar/gerenciar arquivos): `http://localhost:9001`
  - login padrão de dev: `minioadmin` / `minioadmin`

O **bucket** (`erp-arquivos`) é **criado automaticamente** pela API no boot e também antes de
cada upload (`ensureBucket`), então não precisa criar na mão — mesmo que você suba a API antes do MinIO.

Os arquivos persistem num **volume Docker** (`minio-data`), fora da pasta do projeto
(ex.: `/var/lib/docker/volumes/minio-data/_data/`). Não vão pro Git.

---

## 3. Configuração (`.env` da raiz)

```bash
S3_ENDPOINT=http://localhost:9000    # onde a API acessa o MinIO
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=erp-arquivos
S3_PUBLIC_URL=http://localhost:9000
S3_FORCE_PATH_STYLE=true             # MinIO exige path-style
```

Lidas em [`apps/api/src/plugins/env.ts`](../apps/api/src/plugins/env.ts) via `getApiConfig().storage`
(nunca ler `process.env` direto fora daí).

---

## 4. Como o fluxo funciona

Ponto-chave da arquitetura: **o navegador nunca acessa o MinIO diretamente**. Quem fala com o
MinIO é sempre a **API**. Isso evita depender de expor a porta 9000 publicamente e problemas de
CORS/firewall/`localhost`.

### Upload (trocar foto)

```
Front (recorta a imagem)
  → POST /api/usuarios/:id/avatar  (multipart, via proxy do Vite → API)
     → API valida (JPEG/PNG/WebP, ≤ 5 MB)
     → storage.uploadObject(key, ...)  →  grava no MinIO   (key: "avatars/<id>/<uuid>.jpg")
     → grava a KEY em users.avatar_url  (Postgres)
     → responde { url: "/usuarios/:id/avatar" }
```

### Exibição (mostrar a foto)

```
GET /api/usuarios            → users.avatar_url (a key) vira "/usuarios/:id/avatar"
<img src="/api/usuarios/:id/avatar">
  → (proxy Vite) → API GET /usuarios/:id/avatar
     → storage.getObjectStream(key)  →  faz STREAM do objeto do MinIO
     → devolve os bytes da imagem ao navegador
```

O `avatar_url` no banco pode ter 3 formas, tratadas em `montarAvatarUrl` (`database.ts`):
- **vazio** → front mostra as iniciais (fallback).
- **`http`/`data:`** → usado como está (ex.: foto vinda do Microsoft Graph no login SSO).
- **chave de storage** → vira o caminho `/usuarios/:id/avatar` (servido pela API).

---

## 5. Onde está no código

| Arquivo | Papel |
|---|---|
| [`docker-compose.minio.yml`](../docker-compose.minio.yml) | Sobe o container MinIO |
| [`apps/api/src/lib/storage.ts`](../apps/api/src/lib/storage.ts) | Cliente S3 + `ensureBucket`, `uploadObject`, `getObjectStream`, `getPresignedUrl`, `deleteObject` |
| [`apps/api/src/plugins/env.ts`](../apps/api/src/plugins/env.ts) | Config `storage` (vars `S3_*`) |
| [`apps/api/src/routes/uploads.routes.ts`](../apps/api/src/routes/uploads.routes.ts) | `POST /usuarios/:id/avatar` (upload multipart) |
| [`apps/api/src/routes/usuarios.routes.ts`](../apps/api/src/routes/usuarios.routes.ts) | `GET /usuarios/:id/avatar` (stream da imagem, público) |
| [`apps/web/src/components/RH/AvatarUploader.tsx`](../apps/web/src/components/RH/AvatarUploader.tsx) | UI de troca de foto (recorte + upload) |

A lib usa o SDK oficial: `@aws-sdk/client-s3` (o MinIO é S3-compatível).

---

## 6. Boas práticas / produção

- **Credenciais**: em produção, troque `MINIO_ROOT_PASSWORD` no compose e crie uma
  **access key dedicada** (não use a root) no console → coloque em `S3_ACCESS_KEY`/`S3_SECRET_KEY`.
- **Não exponha** as portas 9000/9001 abertas na internet — deixe atrás do firewall/Nginx.
  Como a API faz stream dos arquivos, o navegador **não precisa** alcançar o MinIO.
- **Guardar só a key** no banco (`users.avatar_url`), nunca o arquivo em si.
- **Migrar pra S3/R2 real** um dia: como usamos a API S3 padrão, basta trocar as vars `S3_*`
  (endpoint/credenciais) — o código não muda.
- Ao adicionar novos tipos de arquivo (ex.: documentos), reaproveite `storage.ts` com outro
  prefixo de key (ex.: `documentos/<id>/...`).

---

## 7. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Log da API: `ECONNREFUSED :9000` no boot | MinIO não está rodando | `docker compose -f docker-compose.minio.yml up -d` |
| Upload retorna 500 "bucket does not exist" | Bucket não criado | Já é auto-criado no upload; garanta o MinIO no ar |
| Foto não aparece após upload | Front desatualizado / cache | Hard-refresh (Ctrl+Shift+R) |
| Quer ver os arquivos | — | Console: `http://localhost:9001` (bucket `erp-arquivos`) |
