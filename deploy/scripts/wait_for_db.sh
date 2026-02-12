#!/usr/bin/env sh
set -e

if [ -z "${DATABASE_URL:-}" ] && [ -z "${POSTGRES_HOST:-}" ]; then
  echo "DATABASE_URL/POSTGRES_HOST not set, skipping DB wait."
  exit 0
fi

echo "Waiting for database..."
python - <<'PY'
import os
import sys
import time

import psycopg

database_url = os.getenv("DATABASE_URL", "").strip()
if database_url:
    conninfo = database_url
else:
    conninfo = (
        f"host={os.getenv('POSTGRES_HOST', 'db')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', '')} "
        f"user={os.getenv('POSTGRES_USER', '')} "
        f"password={os.getenv('POSTGRES_PASSWORD', '')}"
    )

for _ in range(60):
    try:
        with psycopg.connect(conninfo=conninfo):
            print("Database is ready.")
            sys.exit(0)
    except Exception:
        time.sleep(1)

print("Database is not reachable.", file=sys.stderr)
sys.exit(1)
PY
