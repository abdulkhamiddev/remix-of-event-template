import os
import secrets
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "").strip()
if not SECRET_KEY:
    SECRET_KEY = os.getenv("SECRET_KEY", "").strip()
if not SECRET_KEY:
    if DEBUG:
        # Dev convenience only. In production, missing DJANGO_SECRET_KEY is a hard failure.
        SECRET_KEY = secrets.token_urlsafe(64)
    else:
        raise ImproperlyConfigured("DJANGO_SECRET_KEY is required when DJANGO_DEBUG is false.")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    'jazzmin',
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",

]
INSTALLED_APPS += [
    "apps.common",
    "apps.accounts",
    "apps.tasks",
    "apps.analytics",
    "apps.review",
    "apps.streak",
    "apps.suggestions",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "apps.common.security_headers.SecurityHeadersMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ]
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

def parse_database_url(url: str) -> dict[str, str]:
    parsed = urlparse(url)
    if parsed.scheme not in {"postgres", "postgresql", "psql"}:
        raise ValueError("Only postgres DATABASE_URL is supported.")
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": unquote(parsed.path.lstrip("/") or ""),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "localhost",
        "PORT": str(parsed.port or 5432),
    }


database_url = os.getenv("DATABASE_URL", "").strip()
if database_url:
    DATABASES = {"default": parse_database_url(database_url)}
elif os.getenv("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.getenv("POSTGRES_DB", ""),
            "USER": os.getenv("POSTGRES_USER", ""),
            "PASSWORD": os.getenv("POSTGRES_PASSWORD", ""),
            "HOST": os.getenv("POSTGRES_HOST", "localhost"),
            "PORT": os.getenv("POSTGRES_PORT", "5432"),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost,http://127.0.0.1,http://localhost:8080,http://127.0.0.1:8080",
)
CORS_ALLOW_CREDENTIALS = env_bool("CORS_ALLOW_CREDENTIALS", False)
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS",
    "http://localhost:8080,http://127.0.0.1:8080",
)
USE_X_FORWARDED_HOST = env_bool("USE_X_FORWARDED_HOST", True)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", not DEBUG)
SESSION_COOKIE_SECURE = env_bool("SESSION_COOKIE_SECURE", not DEBUG)
CSRF_COOKIE_SECURE = env_bool("CSRF_COOKIE_SECURE", not DEBUG)
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
# Legacy header; modern browsers rely on CSP.
SECURE_BROWSER_XSS_FILTER = True
SECURE_HSTS_SECONDS = int(
    os.getenv("DJANGO_SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0")
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool(
    "DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", not DEBUG
)
SECURE_HSTS_PRELOAD = env_bool("DJANGO_SECURE_HSTS_PRELOAD", not DEBUG)
if not DEBUG:
    SECURE_REFERRER_POLICY = "no-referrer"

JWT_ALGORITHM = "HS256"
JWT_ACCESS_TTL_MINUTES = int(os.getenv("JWT_ACCESS_TTL_MINUTES", "15"))
JWT_REFRESH_TTL_DAYS = int(os.getenv("JWT_REFRESH_TTL_DAYS", "7"))

# Shared Redis URL for cache/rate-limit (and Celery if introduced).
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/1")
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
            "IGNORE_EXCEPTIONS": False,
        },
    }
}
RATELIMIT_USE_CACHE = "default"

AUTH_LOGIN_RATE = os.getenv("AUTH_LOGIN_RATE", "5/m")
AUTH_LOGIN_IDENTIFIER_RATE = os.getenv("AUTH_LOGIN_IDENTIFIER_RATE", "20/h")
AUTH_REGISTER_RATE = os.getenv("AUTH_REGISTER_RATE", "3/m")
AUTH_REFRESH_RATE = os.getenv("AUTH_REFRESH_RATE", "10/m")
AUTH_FORGOT_RATE = os.getenv("AUTH_FORGOT_RATE", "3/m")
AUTH_FORGOT_IDENTIFIER_RATE = os.getenv("AUTH_FORGOT_IDENTIFIER_RATE", "20/h")
AUTH_RESET_RATE = os.getenv("AUTH_RESET_RATE", "5/m")
TELEGRAM_MAGIC_RATE = os.getenv("TELEGRAM_MAGIC_RATE", "3/m")
TELEGRAM_CONTACT_RATE = os.getenv("TELEGRAM_CONTACT_RATE", "5/m")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
PUBLIC_APP_URL = (os.getenv("PUBLIC_APP_URL", "http://localhost:8080") or "").strip() or "http://localhost:8080"
if not DEBUG:
    parsed_public_url = urlparse(PUBLIC_APP_URL)
    if parsed_public_url.scheme.lower() != "https":
        raise ImproperlyConfigured("PUBLIC_APP_URL must start with https:// when DJANGO_DEBUG is false.")
TELEGRAM_MAGIC_TTL_MINUTES = int(os.getenv("TELEGRAM_MAGIC_TTL_MINUTES", "5"))
TELEGRAM_MAGIC_RATE_LIMIT = int(os.getenv("TELEGRAM_MAGIC_RATE_LIMIT", "5"))
TELEGRAM_AUTH_MAX_AGE_SECONDS = max(1, int(os.getenv("TELEGRAM_AUTH_MAX_AGE_SECONDS", "120")))
PASSWORD_RESET_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_TTL_MINUTES", "15"))
MAX_TASK_RANGE_DAYS = max(1, int(os.getenv("MAX_TASK_RANGE_DAYS", "31")))
ADMIN_URL = (os.getenv("ADMIN_URL", "/admin/") or "").strip() or "/admin/"
if not ADMIN_URL.startswith("/"):
    ADMIN_URL = f"/{ADMIN_URL}"
if not ADMIN_URL.endswith("/"):
    ADMIN_URL = f"{ADMIN_URL}/"

# Auth cookies (refresh-in-cookie architecture)
AUTH_REFRESH_COOKIE_NAME = (os.getenv("AUTH_REFRESH_COOKIE_NAME", "taskflow_refresh") or "taskflow_refresh").strip()
AUTH_REFRESH_SESSION_COOKIE_NAME = (os.getenv("AUTH_REFRESH_SESSION_COOKIE_NAME", "taskflow_rsid") or "taskflow_rsid").strip()
AUTH_COOKIE_SECURE = env_bool("AUTH_COOKIE_SECURE", not DEBUG)
AUTH_COOKIE_SAMESITE = (os.getenv("AUTH_COOKIE_SAMESITE", "Strict" if not DEBUG else "Lax") or "Lax").strip()
# Backward-compat escape hatch for legacy clients; keep disabled in production.
AUTH_RETURN_REFRESH_IN_BODY = env_bool("AUTH_RETURN_REFRESH_IN_BODY", False)
if AUTH_COOKIE_SAMESITE.lower() not in {"lax", "strict", "none"}:
    raise ImproperlyConfigured("AUTH_COOKIE_SAMESITE must be one of: Strict, Lax, None.")
if not DEBUG and not AUTH_COOKIE_SECURE:
    raise ImproperlyConfigured("AUTH_COOKIE_SECURE must be true when DJANGO_DEBUG is false.")
if not DEBUG and AUTH_RETURN_REFRESH_IN_BODY:
    raise ImproperlyConfigured("AUTH_RETURN_REFRESH_IN_BODY must be false when DJANGO_DEBUG is false.")

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "").strip()
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.sendgrid.net")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "apikey")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", SENDGRID_API_KEY)
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "TaskFlow <no-reply@example.com>")
if DEBUG and not SENDGRID_API_KEY:
    EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
else:
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
