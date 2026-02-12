import hashlib
import os
import secrets
from datetime import timedelta

from django.utils import timezone

from apps.accounts.models import TelegramMagicLink, User
from apps.common.exceptions import APIError


def normalize_phone(phone_raw: str) -> str:
    raw = (phone_raw or "").strip()
    if not raw:
        raise APIError("Phone number is required.", code="validation_error", status=422, fields={"phone": "required"})

    cleaned = "".join(ch for ch in raw if ch.isdigit() or ch == "+")
    digits = "".join(ch for ch in cleaned if ch.isdigit())
    if cleaned.startswith("00") and len(digits) > 2:
        digits = digits[2:]

    if len(digits) < 8 or len(digits) > 15:
        raise APIError(
            "Phone number format is invalid.",
            code="validation_error",
            status=422,
            fields={"phone": "invalid_format"},
        )
    # Store phone in a stable E.164-like canonical form to prevent duplicates.
    return f"+{digits}"


def phone_lookup_candidates(phone_raw: str) -> list[str]:
    normalized = normalize_phone(phone_raw)
    digits = normalized[1:]
    return [normalized, digits, f"00{digits}"]


def safe_username(base: str) -> str:
    candidate = "".join(ch for ch in base if ch.isalnum() or ch in {"_", "-", "."}).strip("_-.")[:150] or "user"
    current = candidate
    index = 1
    while User.objects.filter(username__iexact=current).exists():
        suffix = str(index)
        current = f"{candidate[: max(1, 150 - len(suffix))]}{suffix}"
        index += 1
    return current


def hash_magic_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_magic_token() -> str:
    # 48 bytes random -> high entropy one-time token
    return secrets.token_urlsafe(48)


def get_magic_link_ttl_minutes() -> int:
    return max(1, int(os.getenv("TELEGRAM_MAGIC_TTL_MINUTES", "5")))


def get_magic_link_rate_limit() -> int:
    return max(1, int(os.getenv("TELEGRAM_MAGIC_RATE_LIMIT", "5")))


def build_magic_link_url(token: str) -> str:
    public_app_url = os.getenv("PUBLIC_APP_URL", "http://localhost:8080").rstrip("/")
    return f"{public_app_url}/auth/telegram?token={token}"


def assert_rate_limit(telegram_id: int | None, phone: str | None) -> None:
    now = timezone.now()
    window_start = now - timedelta(minutes=get_magic_link_ttl_minutes())
    queryset = TelegramMagicLink.objects.filter(created_at__gte=window_start)
    if telegram_id is not None:
        queryset = queryset.filter(telegram_id=telegram_id)
    elif phone:
        queryset = queryset.filter(phone=phone)
    else:
        return

    if queryset.count() >= get_magic_link_rate_limit():
        raise APIError(
            "Too many login link requests. Please wait and try again.",
            code="rate_limited",
            status=429,
        )


def create_magic_link(
    user: User | None = None,
    *,
    telegram_id: int | None = None,
    telegram_username: str | None = None,
    telegram_first_name: str | None = None,
    phone: str | None = None,
) -> tuple[str, TelegramMagicLink]:
    assert_rate_limit(telegram_id=telegram_id, phone=phone)
    token = generate_magic_token()
    link = TelegramMagicLink.objects.create(
        user=user,
        token_hash=hash_magic_token(token),
        expires_at=timezone.now() + timedelta(minutes=get_magic_link_ttl_minutes()),
        telegram_id=telegram_id,
        telegram_username=(telegram_username or "").strip(),
        telegram_first_name=(telegram_first_name or "").strip(),
        phone=phone or "",
    )
    return token, link


def consume_magic_token(token: str) -> TelegramMagicLink:
    token_hash = hash_magic_token(token)
    link = TelegramMagicLink.objects.select_for_update().select_related("user").filter(token_hash=token_hash).first()
    if not link:
        raise APIError("Login link is invalid.", code="invalid_magic_link", status=401)
    if link.is_used:
        raise APIError("Login link has already been used.", code="magic_link_used", status=401)
    if link.is_expired:
        raise APIError("Login link has expired.", code="magic_link_expired", status=401)
    link.used_at = timezone.now()
    link.save(update_fields=["used_at"])
    return link
