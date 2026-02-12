# TaskFlow Backend (Django Ninja)

## Stack
- Django + Django Ninja
- PostgreSQL (Docker compose)
- JWT (`Authorization: Bearer <accessToken>`)
- API prefix: `/api/*` (no `/api/v1`)

## Implemented API Contracts

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh` (refresh rotation: revoke old, issue new)
- `POST /api/auth/logout`
- `GET /api/auth/me` -> `{ id, email, username, displayName }`
- `POST /api/auth/telegram` -> `{ initData }`

### Tasks
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/{id}`
- `PATCH /api/tasks/{id}`
- `DELETE /api/tasks/{id}`
- `POST /api/tasks/{id}/complete`
- `POST /api/tasks/{id}/start-timer`
- `POST /api/tasks/{id}/stop-timer`

### Categories
- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/{id}`
- `DELETE /api/categories/{id}`

### Settings
- `GET /api/settings`
- `PATCH /api/settings`

### Analytics
- `GET /api/analytics/weekly?date=YYYY-MM-DD`
- `GET /api/analytics/monthly?year=YYYY&month=MM`
- `GET /api/analytics/yearly?year=YYYY`

Analytics response is camelCase and includes:
- `rangeLabel`
- `stats`
- `trendData`
- `categoryStats`
- `productivePeriods`

## Docs / Health
- Swagger: `http://localhost:8000/api/docs`
- Health: `http://localhost:8000/healthz`

## Environment
1. Copy env file:
```bash
cp .env.example .env
```
2. Set required values:
- `DJANGO_SECRET_KEY`
- `POSTGRES_*`
- `TELEGRAM_BOT_TOKEN` (only needed for `/api/auth/telegram`)

## Local Run (without Docker)
```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py seed_demo
python manage.py runserver 0.0.0.0:8000
```

## Docker Run
```bash
cd backend
docker compose up --build
```

Then in another shell:
```bash
cd backend
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py seed_demo
```

## Seed
`seed_demo` command creates:
- 1 demo user
- 5 categories
- 30 mixed tasks

Example:
```bash
cd backend
python manage.py seed_demo --email demo@example.com --username demo --password DemoPass123! --tasks 30
```

## Smoke Test
- HTTP file: `backend/smoke_test.http`
- Covers: register/login/me, category create, task create/complete, analytics weekly/monthly/yearly.

## Frontend Migration (localStorage -> API)

Update these frontend files:
1. `frontend/src/contexts/TaskContext.tsx`
- Replace `useLocalStorage('todo-app-tasks')` with API calls to:
  - `GET /api/tasks`
  - `POST /api/tasks`
  - `PATCH /api/tasks/{id}`
  - `DELETE /api/tasks/{id}`
  - `POST /api/tasks/{id}/complete`
  - `POST /api/tasks/{id}/start-timer`
  - `POST /api/tasks/{id}/stop-timer`
- Replace category local state with:
  - `GET /api/categories`
  - `POST /api/categories`
  - `PATCH /api/categories/{id}`
  - `DELETE /api/categories/{id}`

2. `frontend/src/contexts/ThemeContext.tsx`
- Replace `useLocalStorage('todo-app-settings')` with:
  - `GET /api/settings`
  - `PATCH /api/settings`

3. `frontend/src/lib/apiClient.ts`
- Keep current logic. It already matches:
  - Access token in `Authorization` header
  - Refresh endpoint `POST /api/auth/refresh` with `{ refresh }`

4. API base URL
- If `VITE_API_URL` is empty, Vite proxy handles `/api` -> `http://localhost:8000`.
- Optional: set `VITE_API_URL=http://localhost:8000`.
