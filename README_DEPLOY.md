# Deployment Notes

## Secrets Rotation Required
If any secrets or local artifacts were ever committed or pushed, rotate all credentials before exposing the system on the public internet:

- Django `DJANGO_SECRET_KEY`
- `SENDGRID_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- database passwords / `DATABASE_URL`

## Admin Exposure
Set `ADMIN_URL` to a non-default path (for example `/admin-<random>/`) and apply edge rate limiting and IP allowlisting if possible.

## Nginx Production Baseline
Use `deploy/nginx/nginx.prod.conf` as the production baseline:

- TLS 1.2+ only
- HSTS + referrer policy + nosniff + frame deny
- strict CSP header for SPA paths
- auth/admin rate limiting
- body size limits
- forwarding-header sanitization (overwrites `X-Forwarded-For`)

## Trusted Proxy Networks
Set `TRUSTED_PROXY_NETS` in backend env to only your edge/load-balancer CIDRs.  
If left empty, backend ignores `X-Forwarded-For` and uses direct peer IP.

## Periodic Cleanup
Run token cleanup periodically (cron/Task Scheduler):

```bash
cd backend
python manage.py cleanup_tokens --days 30
```
