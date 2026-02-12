#!/usr/bin/env sh
set -e

/wait_for_db.sh

python manage.py migrate --noinput
python manage.py collectstatic --noinput

exec gunicorn config.asgi:application \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}"
