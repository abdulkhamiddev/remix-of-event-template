#!/usr/bin/env sh
set -eu

# Usage:
#   APP_ROLE=web sh start.sh
#   APP_ROLE=bot sh start.sh
#
# Optional positional arg also works:
#   sh start.sh web
#   sh start.sh bot

role="${1:-${APP_ROLE:-web}}"

if [ "$role" = "web" ]; then
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput

  exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile "-" \
    --error-logfile "-"
fi

if [ "$role" = "bot" ]; then
  exec python -m bot.main
fi

echo "Unknown APP_ROLE: $role (expected: web or bot)" >&2
exit 1
