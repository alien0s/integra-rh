# ERP ACEAM Monorepo

Monorepo ERP com React, Vite, shadcn base, Fastify, Turborepo e pnpm workspaces.

## Estrutura

- `apps/web`: frontend React com Vite.
- `apps/api`: API Fastify.
- `packages/shared-types`: modelos compartilhados.
- `packages/shared-ui`: componentes React compartilhados.
- `packages/rh-core`: regras e utilitarios de RH.

## Comandos

```bash
pnpm install
pnpm dev


cd /home/inovacao/integra-rh
pnpm build          # builda api + web juntos


```
## reinciar o pm2

cp -r apps/web/dist/* /var/www/integra/    # atualiza o front servido pelo nginx
pm2 restart integra-api                     # atualiza a API (recarrega o dist/server.js novo)


Por padrao, o web roda em `http://localhost:5173` e a API em `http://localhost:3333`.
