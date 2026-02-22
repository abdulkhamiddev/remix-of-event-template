# Backend Notes

## Secrets Rotation Required
If this repository was ever pushed to a remote (GitHub/GitLab/etc), assume secrets may have leaked and **rotate them immediately**:

- `DJANGO_SECRET_KEY`
- JWT signing key material (derived from `DJANGO_SECRET_KEY` in this repo)
- `SENDGRID_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- database passwords / `DATABASE_URL`

Also remove any committed local artifacts (for example `backend/db.sqlite3`) from git history if they contained real user data.

