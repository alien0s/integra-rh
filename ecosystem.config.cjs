// Config do PM2 pra API em produção (apps/web é estático, servido pelo nginx
// — não entra aqui). Uso:
//   pnpm build:api            # gera apps/api/dist/server.js
//   pm2 start ecosystem.config.cjs
//   pm2 save                  # persiste a lista atual pro restart automático
//
// Lê as variáveis de ambiente do .env da raiz do monorepo (mesmo arquivo que
// `pnpm --filter @erp/api start` já usa) via a flag nativa do Node
// --env-file (Node >= 20.6).
module.exports = {
  apps: [
    {
      name: 'integra-api',
      cwd: __dirname + '/apps/api',
      script: 'dist/server.js',
      node_args: '--env-file=../../.env',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      // Log fica em ~/.pm2/logs por padrão — dá pra apontar pra outro lugar
      // com `error_file`/`out_file` se preferir centralizar em /var/log.
    },
  ],
}
