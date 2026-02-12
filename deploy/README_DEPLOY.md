# Production Deploy (Docker + Nginx)

This setup runs:
- `backend` (Django Ninja + Gunicorn/Uvicorn worker)
- `nginx` (serves SPA + proxies `/api/` and `/admin/`)
- `db` (PostgreSQL)
- `redis` (cache/rate-limit backend)
- optional `bot` (`python -m bot.main`)

## File layout
- `deploy/docker-compose.prod.yml`
- `deploy/backend/Dockerfile`
- `deploy/frontend/Dockerfile`
- `deploy/nginx/default.conf`
- `deploy/scripts/entrypoint_backend.sh`
- `deploy/scripts/wait_for_db.sh`
- `deploy/env/.env.backend`
- `deploy/env/.env.db`

## 1) Prepare env files

Linux/macOS:
```bash
cp deploy/env/.env.backend.example deploy/env/.env.backend
cp deploy/env/.env.db.example deploy/env/.env.db
```

Windows (PowerShell):
```powershell
Copy-Item deploy/env/.env.backend.example deploy/env/.env.backend
Copy-Item deploy/env/.env.db.example deploy/env/.env.db
```

Update at least:
- `DJANGO_SECRET_KEY`
- `DJANGO_ALLOWED_HOSTS`
- `CORS_ALLOWED_ORIGINS`
- `CSRF_TRUSTED_ORIGINS`
- `PUBLIC_APP_URL`
- `DJANGO_SECURE_SSL_REDIRECT=True`
- `SESSION_COOKIE_SECURE=True`
- `CSRF_COOKIE_SECURE=True`
- `DJANGO_SECURE_HSTS_SECONDS=31536000`
- `POSTGRES_PASSWORD`
- `REDIS_URL`
- `SENDGRID_API_KEY`
- `DEFAULT_FROM_EMAIL`

Do not use `*` in CORS/CSRF for production.

## SendGrid SMTP setup
1. In SendGrid, create an API key with Mail Send permission.
2. Put API key into `SENDGRID_API_KEY`.
3. Keep SMTP values:
   - `EMAIL_HOST=smtp.sendgrid.net`
   - `EMAIL_PORT=587`
   - `EMAIL_HOST_USER=apikey`
   - `EMAIL_USE_TLS=True`
4. Set `DEFAULT_FROM_EMAIL` to a verified sender/domain.

## 2) Start production stack
```bash
docker compose -f deploy/docker-compose.prod.yml up --build
```

Open:
- `http://localhost` -> React SPA
- `http://localhost/admin` -> Django Admin
- `http://localhost/api/...` -> API

## 3) Admin user
In a second shell:
```bash
docker compose -f deploy/docker-compose.prod.yml exec backend python manage.py createsuperuser
```

## 4) Optional Telegram bot service
Bot is profile-gated. Start with:
```bash
docker compose -f deploy/docker-compose.prod.yml --profile bot up --build
```

If `TELEGRAM_BOT_TOKEN` is empty, keep bot profile disabled.

## Static/media/templates behavior
- Django templates are loaded from `backend/templates` (via `TEMPLATES["DIRS"]`).
- Static files are collected into `backend/staticfiles` inside backend container.
- Nginx serves:
  - `/static/` from `staticfiles` volume
  - `/media/` from `media` volume
- Admin CSS works with `DEBUG=False` because static is collected and served by Nginx.

## SPA routing
Nginx uses `try_files $uri $uri/ /index.html`, so refresh on routes like:
- `/landing`
- `/guide`
- `/features`
- `/tasks/...`
does not 404.

## Docs exposure policy
`/api/docs` and `/api/openapi.json` remain:
- open in development (`DEBUG=True`)
- hidden (404) for non-staff in production (`DEBUG=False`)
- available only for authenticated staff when `DEBUG=False`

## Rate-limit smoke checks
After stack is up and Redis is running:
1. Send 6 rapid `POST /api/auth/login` calls from same IP -> 6th should return `429` with `{"detail":"rate_limited","retry_after":...}`.
2. Wait for window expiry (default 60s) -> login should succeed again.
3. Repeat from a different client/IP -> should not be blocked by first client's limit bucket.
4. Spam `POST /api/auth/telegram/magic` with same token metadata/IP -> should return `429`.

## Password reset verification
1. Open `/forgot-password` in frontend and submit existing or non-existing identifier.
2. UI should always show the same success message (no account enumeration).
3. In development (`DEBUG=True` without `SENDGRID_API_KEY`) reset email is printed to backend console.
4. Open printed link `/reset-password?token=...` and submit new password.
5. Login should succeed with the new password and reset token must fail on second use.

## Development workflow (recommended)
For local development, continue using existing local run flow (Vite dev server + Django runserver) instead of production compose.

## HTTPS with DuckDNS + Let's Encrypt
For public HTTPS termination in front of this stack, use:
- `deploy/https/docker-compose.https.yml`
- `deploy/https/README_HTTPS.md`
