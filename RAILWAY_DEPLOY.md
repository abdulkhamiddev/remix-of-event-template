# Railway Deploy (Git Repo, Railway Domains Only)

Bu loyiha Railway uchun tayyorlangan: `frontend + backend + bot`.
Custom domain shart emas, Railway bergan `*.up.railway.app` domenlari bilan ishlaydi.

## 1) Bir marta qilinadigan setup

Railway project oching va shu Git repoga ulang, keyin 3 ta service yarating:

1. `frontend` (Root Directory: `frontend`)
2. `backend` (Root Directory: `backend`)
3. `bot` (Root Directory: `backend`)

Pluginlar:

4. `Postgres`
5. `Redis`

`Postgres` va `Redis`ni `backend` hamda `bot` service'lariga link qiling.

## 2) Start/build commandlar

Bu repoda commandlar koddan olinadi:

- `backend/Procfile` -> `web: sh start.sh`
- `frontend/Procfile` -> `web: npm run start`

`backend/start.sh` rolega qarab ishga tushadi:

- `APP_ROLE=web` -> Django + Gunicorn
- `APP_ROLE=bot` -> Telegram bot worker

Shu sabab `bot` service'da `APP_ROLE=bot` qo'yish kifoya.

## 3) Railway Variables (copy/paste)

### `backend` service variables

```env
APP_ROLE=web
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<strong-secret>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
DJANGO_ALLOWED_HOSTS=${{RAILWAY_PUBLIC_DOMAIN}}
PUBLIC_APP_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
CORS_ALLOWED_ORIGINS=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
CSRF_TRUSTED_ORIGINS=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
CORS_ALLOW_CREDENTIALS=true
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=None
AUTH_RETURN_REFRESH_IN_BODY=false
ADMIN_URL=/admin-very-random/
TELEGRAM_BOT_TOKEN=<telegram-token>
WEB_CONCURRENCY=2
GUNICORN_TIMEOUT=60
```

### `bot` service variables

```env
APP_ROLE=bot
DJANGO_SETTINGS_MODULE=config.settings
DJANGO_DEBUG=false
DJANGO_SECRET_KEY=<same-as-backend>
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
PUBLIC_APP_URL=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
TELEGRAM_BOT_TOKEN=<same-telegram-token>
```

### `frontend` service variables

```env
VITE_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}
VITE_AUTH_MOCK=false
VITE_TELEGRAM_BOT_USERNAME=<your_bot_username>
```

## 4) Deploy flow

1. Repo push qiling.
2. Railway auto deploy qiladi.
3. `backend` service'da public networking yoqilgan bo'lsin (domain beriladi).
4. `frontend` service'da ham public networking yoqilgan bo'lsin.
5. `bot` worker'da public domain shart emas.

## 5) Tekshiruv

- Backend health: `https://<backend>.up.railway.app/healthz`
- Frontend ochilishi: `https://<frontend>.up.railway.app`
- Bot: Railway log'da polling boshlangani ko'rinishi kerak.

## 6) Eslatma

- `AUTH_COOKIE_SAMESITE=None` Railway default domenlarda (`frontend` va `backend` alohida origin) refresh-cookie ishlashi uchun kerak.
- `frontend` va `backend` domenlari deploydan keyin Railway tomonidan beriladi; yuqoridagi `${{...}}` reference'lar orqali avtomatik ulanadi.
