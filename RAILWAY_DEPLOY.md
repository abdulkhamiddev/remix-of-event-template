# Railway Deploy (Frontend + Backend + Bot)

This repository is deployed as a Railway monorepo with 3 services:

- `frontend` (Web)
- `backend` (Web)
- `bot` (Worker)

## 1) Create services in Railway

Create one Railway project and connect this Git repository, then add:

1. Service `frontend` with **Root Directory**: `frontend`
2. Service `backend` with **Root Directory**: `backend`
3. Service `bot` with **Root Directory**: `backend`
4. Add Railway `Postgres` plugin
5. Add Railway `Redis` plugin

Link both plugins to `backend` and `bot`.

## 2) Service commands

### `frontend` service

- Build Command: `npm ci && npm run build`
- Start Command: `npm run start`

### `backend` service

- Build Command: `pip install -r requirements.txt`
- Start Command: `APP_ROLE=web sh start.sh`

### `bot` service

- Build Command: `pip install -r requirements.txt`
- Start Command: `APP_ROLE=bot sh start.sh`

## 3) Variables for `backend`

Set these in Railway Variables for `backend`:

```env
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<generate-strong-secret>
DATABASE_URL=<from-linked-railway-postgres>
REDIS_URL=<from-linked-railway-redis>
DJANGO_ALLOWED_HOSTS=api.your-domain.com
PUBLIC_APP_URL=https://app.your-domain.com
CORS_ALLOWED_ORIGINS=https://app.your-domain.com
CSRF_TRUSTED_ORIGINS=https://app.your-domain.com,https://api.your-domain.com
CORS_ALLOW_CREDENTIALS=true
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=Strict
AUTH_RETURN_REFRESH_IN_BODY=false
ADMIN_URL=/admin-very-random/
TELEGRAM_BOT_TOKEN=<your-telegram-bot-token>
SENDGRID_API_KEY=<optional-sendgrid-key>
DEFAULT_FROM_EMAIL=TaskFlow <no-reply@your-domain.com>
WEB_CONCURRENCY=2
GUNICORN_TIMEOUT=60
```

## 4) Variables for `bot`

Set these in Railway Variables for `bot`:

```env
DJANGO_SETTINGS_MODULE=config.settings
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<same-as-backend>
DATABASE_URL=<from-linked-railway-postgres>
REDIS_URL=<from-linked-railway-redis>
PUBLIC_APP_URL=https://app.your-domain.com
TELEGRAM_BOT_TOKEN=<same-bot-token>
```

## 5) Variables for `frontend`

Set these in Railway Variables for `frontend`:

```env
VITE_API_URL=https://api.your-domain.com
VITE_AUTH_MOCK=false
VITE_TELEGRAM_BOT_USERNAME=your_bot_username
```

## 6) Domains

Attach custom domains:

- `frontend` -> `app.your-domain.com`
- `backend` -> `api.your-domain.com`

Then redeploy all services.

## 7) Health checks

After deploy:

- Backend: `GET https://api.your-domain.com/healthz` should return `{"status":"ok"}`
- Frontend: open `https://app.your-domain.com`
- Bot: check logs and run `/start login` in Telegram
