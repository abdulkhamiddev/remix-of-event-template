#!/bin/sh
set -eu

if [ -z "${DOMAIN:-}" ]; then
  echo "DOMAIN is required (example: my-app.duckdns.org)"
  exit 1
fi

if [ -z "${EMAIL:-}" ]; then
  echo "EMAIL is required for Let's Encrypt registration"
  exit 1
fi

echo "[certbot-init] requesting certificate for ${DOMAIN}"
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  --cert-name edge \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  --keep-until-expiring \
  -d "${DOMAIN}"

echo "[certbot-init] done. restart edge nginx to pick up issued certificate."
