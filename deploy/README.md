# Deploy — integra.aceam.org.br

nginx (1.24) e PM2 (7.0.1) já estão instalados nesta máquina — não precisa
instalar nada, só configurar. Os comandos abaixo com `sudo` precisam ser
rodados por você (senha interativa); o resto já foi feito.

## 1. Primeira vez (setup)

```bash
# Cria a pasta de arquivos estáticos (fora do /home, que o www-data não alcança)
sudo mkdir -p /var/www/integra
sudo chown inovacao:inovacao /var/www/integra

# Copia o build do front pra lá (repetir a cada novo deploy do front)
cp -r /home/inovacao/integra-rh/apps/web/dist/* /var/www/integra/

# Instala o site do nginx
sudo cp /home/inovacao/integra-rh/deploy/nginx/integra.conf /etc/nginx/sites-available/integra
sudo ln -s /etc/nginx/sites-available/integra /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Deixa o PM2 subir a API sozinho depois de um reboot da máquina
sudo env PATH=$PATH:/home/inovacao/.nvm/versions/node/v20.20.2/bin /home/inovacao/.nvm/versions/node/v20.20.2/lib/node_modules/pm2/bin/pm2 startup systemd -u inovacao --hp /home/inovacao
```

A API já está rodando via PM2 (`pm2 list` mostra `integra-api` online, na
porta 3000) e `pm2 save` já foi rodado — depois do comando `pm2 startup`
acima, ela volta sozinha se a máquina reiniciar.

**Antes de apontar o DNS pra valer**, revise o `.env`: o modelo em
`.env.production.example` tem os valores de produção (domínio, segredos
novos, `MICROSOFT_REDIRECT_URI` pra registrar no Azure AD, etc.) — o `.env`
atual ainda tem valores de dev (`localhost`). Depois de atualizar o `.env`:

```bash
pnpm build:web && cp -r apps/web/dist/* /var/www/integra/   # front lê VITE_* em build-time
pm2 restart integra-api                                     # API relê o .env
```

**HTTPS**: depois que o DNS de `integra.aceam.org.br` estiver apontando pra
esta máquina, rodar o certbot (`sudo apt install certbot python3-certbot-nginx`
se ainda não tiver, depois `sudo certbot --nginx -d integra.aceam.org.br`) —
ele mesmo edita o site do nginx pra redirecionar HTTP → HTTPS.

## 2. Redeploy (depois que já está tudo configurado)

```bash
cd /home/inovacao/integra-rh
git pull                     # se aplicável
pnpm install
pnpm build                   # api + web

cp -r apps/web/dist/* /var/www/integra/
pm2 restart integra-api
```

## Arquivos

- `ecosystem.config.cjs` (raiz do repo) — config do PM2 pra API.
- `deploy/nginx/integra.conf` — site do nginx (front estático + proxy `/api`).
- `.env.production.example` (raiz do repo) — modelo de variáveis de produção.
