#!/usr/bin/env sh
set -eu

echo "[entrypoint] starting..."

# ---- Helpers ----
wait_for_db() {
  # Works with either DATABASE_URL or POSTGRES_HOST/POSTGRES_PORT
  if [ -n "${DATABASE_URL:-}" ]; then
    echo "[entrypoint] DATABASE_URL is set, checking DB..."
    python - <<'PY'
import os, sys, time
import urllib.parse as up
import socket

u = up.urlparse(os.environ["DATABASE_URL"])
host = u.hostname
port = u.port or 5432

deadline = time.time() + int(os.getenv("DB_WAIT_TIMEOUT", "60"))
while True:
    try:
        with socket.create_connection((host, port), timeout=3):
            print("[entrypoint] DB reachable:", host, port)
            sys.exit(0)
    except OSError as e:
        if time.time() > deadline:
            print("[entrypoint] DB not reachable within timeout:", e)
            sys.exit(1)
        time.sleep(2)
PY
  elif [ -n "${POSTGRES_HOST:-}" ]; then
    host="${POSTGRES_HOST}"
    port="${POSTGRES_PORT:-5432}"
    echo "[entrypoint] POSTGRES_HOST set, checking DB at ${host}:${port}..."
    python - <<PY
import os, sys, time, socket
host = os.environ["POSTGRES_HOST"]
port = int(os.getenv("POSTGRES_PORT", "5432"))
deadline = time.time() + int(os.getenv("DB_WAIT_TIMEOUT", "60"))
while True:
    try:
        with socket.create_connection((host, port), timeout=3):
            print("[entrypoint] DB reachable:", host, port)
            sys.exit(0)
    except OSError as e:
        if time.time() > deadline:
            print("[entrypoint] DB not reachable within timeout:", e)
            sys.exit(1)
        time.sleep(2)
PY
  else
    echo "[entrypoint] DATABASE_URL/POSTGRES_HOST not set; skipping DB wait."
  fi
}

# ---- Preflight ----
if [ "${WAIT_FOR_DB:-1}" = "1" ]; then
  wait_for_db
fi

# ---- Django management ----
if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[entrypoint] Running migrations..."
  python manage.py migrate --noinput
fi

if [ "${COLLECTSTATIC:-1}" = "1" ]; then
  echo "[entrypoint] Collecting static..."
  python manage.py collectstatic --noinput
fi

# ---- Start server ----
# Prefer explicit command, but also provide a safe default for production.
if [ "${1:-}" = "" ]; then
  # If no command passed, default to gunicorn WSGI app
  : "${GUNICORN_APP:=config.wsgi:application}"
  : "${PORT:=8000}"
  : "${WEB_CONCURRENCY:=1}"
  : "${GUNICORN_TIMEOUT:=60}"

  echo "[entrypoint] No command provided; starting gunicorn..."
  exec gunicorn "$GUNICORN_APP" \
    --bind "0.0.0.0:${PORT}" \
    --workers "${WEB_CONCURRENCY}" \
    --timeout "${GUNICORN_TIMEOUT}" \
    --access-logfile "-" \
    --error-logfile "-"
else
  echo "[entrypoint] Executing command: $*"
  exec "$@"
fi
