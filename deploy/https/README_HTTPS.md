# HTTPS Edge (DuckDNS + Let's Encrypt)

This layer adds a public HTTPS terminator in front of the existing production stack.

Traffic flow:
- Internet -> `edge` nginx (`:80` / `:443`)
- `edge` -> internal `nginx` service from `deploy/docker-compose.prod.yml`
- internal `nginx` continues serving SPA, `/api`, `/admin`, `/static`, `/media`

## 1) Prepare env files

Linux/macOS:
```bash
cp deploy/env/.env.edge.example deploy/env/.env.edge
cp deploy/env/.env.backend.example deploy/env/.env.backend
cp deploy/env/.env.db.example deploy/env/.env.db
```

Windows (PowerShell):
```powershell
Copy-Item deploy/env/.env.edge.example deploy/env/.env.edge
Copy-Item deploy/env/.env.backend.example deploy/env/.env.backend
Copy-Item deploy/env/.env.db.example deploy/env/.env.db
```

Set in `deploy/env/.env.edge`:
- `DOMAIN=your-subdomain.duckdns.org`
- `EMAIL=your-email@example.com`

Set in `deploy/env/.env.backend`:
- `DJANGO_ALLOWED_HOSTS=your-subdomain.duckdns.org`
- `CSRF_TRUSTED_ORIGINS=https://your-subdomain.duckdns.org`
- `CORS_ALLOWED_ORIGINS=https://your-subdomain.duckdns.org`
- `PUBLIC_APP_URL=https://your-subdomain.duckdns.org`

Do not use wildcards in CORS/CSRF for production.

## 2) Start internal stack (no public ports)

```bash
docker compose -f deploy/docker-compose.prod.yml -f deploy/https/docker-compose.https.yml up -d --build db redis backend nginx
```

Note:
- In overlay mode, host ports `80/443` are owned by `edge`.
- Internal `nginx` is reachable only inside Docker network.

## 3) Start edge + renewal container

```bash
docker compose -f deploy/docker-compose.prod.yml -f deploy/https/docker-compose.https.yml up -d edge certbot-renew
```

## 4) Issue first Let's Encrypt certificate

```bash
docker compose -f deploy/docker-compose.prod.yml -f deploy/https/docker-compose.https.yml run --rm certbot-init
docker compose -f deploy/docker-compose.prod.yml -f deploy/https/docker-compose.https.yml restart edge
```

After that, open:
- `https://your-subdomain.duckdns.org`
- `https://your-subdomain.duckdns.org/admin`
- `https://your-subdomain.duckdns.org/api/...`

## 5) DuckDNS updater (optional container)

If you want auto IP updates, configure `SUBDOMAINS` and `TOKEN` in `deploy/env/.env.edge`, then start:

```bash
docker compose -f deploy/docker-compose.prod.yml -f deploy/https/docker-compose.https.yml --profile duckdns up -d duckdns
```

If you do not run this container, update DuckDNS records manually from DuckDNS dashboard/script.

## 6) Renewal plan

- `certbot-renew` runs continuously and executes `certbot renew` every 12h by default.
- `edge` reloads nginx periodically, so renewed cert files are picked up automatically.

Check status:
```bash
docker compose -f deploy/docker-compose.prod.yml -f deploy/https/docker-compose.https.yml logs -f certbot-renew
docker compose -f deploy/docker-compose.prod.yml -f deploy/https/docker-compose.https.yml logs -f edge
```
