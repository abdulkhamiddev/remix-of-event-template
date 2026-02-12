import hashlib
import hmac
import json
from datetime import UTC, datetime
from uuid import UUID
from urllib.parse import parse_qsl

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from ninja import Router

from apps.accounts.models import RefreshToken
from apps.accounts.schemas import (
    AuthResponse,
    AuthUserOut,
    LoginIn,
    LogoutIn,
    RefreshIn,
    RefreshResponse,
    RegisterIn,
    TelegramAuthIn,
)
from apps.common.auth import JWTAuth
from apps.common.exceptions import APIError
from apps.common.jwt import JWTDecodeError, create_access_token, create_refresh_token, decode_token

router = Router(tags=["auth"])
User = get_user_model()


def _normalize_identifier(email: str | None, username: str | None) -> tuple[str | None, str | None]:
    normalized_email = (email or "").strip().lower() or None
    normalized_username = (username or "").strip() or None
    if not normalized_email and normalized_username and "@" in normalized_username:
        normalized_email = normalized_username.lower()
        normalized_username = None
    return normalized_email, normalized_username


def _safe_username(base: str) -> str:
    candidate = "".join(ch for ch in base if ch.isalnum() or ch in {"_", "-", "."}).strip("_-.")[:150] or "user"
    current = candidate
    index = 1
    while User.objects.filter(username__iexact=current).exists():
        suffix = str(index)
        current = f"{candidate[: max(1, 150 - len(suffix))]}{suffix}"
        index += 1
    return current


def _safe_username_from_email(email: str) -> str:
    local = email.split("@", 1)[0] if "@" in email else email
    return _safe_username(local)


def _serialize_user(user) -> AuthUserOut:
    display_name = user.display_name or user.username or user.email or None
    return AuthUserOut(
        id=str(user.id),
        email=user.email or None,
        username=user.username or None,
        displayName=display_name,
    )


def _request_meta(request) -> tuple[str, str]:
    user_agent = request.headers.get("user-agent", "")[:255]
    ip_address = (request.META.get("HTTP_X_FORWARDED_FOR") or request.META.get("REMOTE_ADDR") or "").split(",")[0].strip()
    return user_agent, ip_address or ""


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _issue_tokens(user, request) -> tuple[dict, RefreshToken]:
    access, _ = create_access_token(user.id)
    refresh, refresh_payload = create_refresh_token(user.id)
    user_agent, ip_address = _request_meta(request)
    token_record = RefreshToken.objects.create(
        user=user,
        jti=UUID(str(refresh_payload["jti"])),
        token_hash=_hash_refresh_token(refresh),
        expires_at=datetime.fromtimestamp(refresh_payload["exp"], tz=UTC),
        user_agent=user_agent,
        ip_address=ip_address or None,
    )
    return {"access": access, "refresh": refresh}, token_record


def _revoke_token(token_record: RefreshToken, replaced_by: RefreshToken | None = None) -> None:
    token_record.revoked_at = timezone.now()
    token_record.replaced_by = replaced_by
    token_record.save(update_fields=["revoked_at", "replaced_by"])


def _authenticate(email: str | None, username: str | None, password: str):
    user = None
    if email:
        user = User.objects.filter(email__iexact=email).first()
    elif username:
        user = User.objects.filter(username__iexact=username).first()

    if not user or not check_password(password, user.password):
        raise APIError("Invalid credentials.", code="invalid_credentials", status=401)
    if not user.is_active:
        raise APIError("Account is disabled.", code="inactive_user", status=403)
    return user


def _parse_telegram_init_data(init_data: str) -> dict[str, str]:
    return dict(parse_qsl(init_data, keep_blank_values=True))


def _verify_telegram_hash(init_data: str) -> dict[str, str]:
    bot_token = settings.TELEGRAM_BOT_TOKEN
    if not bot_token:
        raise APIError("Telegram login is not configured.", code="telegram_not_configured", status=500)

    parsed = _parse_telegram_init_data(init_data)
    incoming_hash = parsed.pop("hash", None)
    if not incoming_hash:
        raise APIError("Telegram auth hash is missing.", code="invalid_telegram_data", status=401)

    data_check_string = "\n".join(f"{key}={parsed[key]}" for key in sorted(parsed.keys()))
    secret = hashlib.sha256(bot_token.encode("utf-8")).digest()
    expected_hash = hmac.new(secret, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected_hash, incoming_hash):
        raise APIError("Telegram auth hash is invalid.", code="invalid_telegram_hash", status=401)
    return parsed


def _extract_telegram_user(data: dict[str, str]) -> tuple[int, str | None, str]:
    user_payload = {}
    if data.get("user"):
        try:
            raw_user = json.loads(data["user"])
            if isinstance(raw_user, dict):
                user_payload = raw_user
        except json.JSONDecodeError:
            user_payload = {}

    raw_id = user_payload.get("id") or data.get("id")
    if raw_id is None:
        raise APIError("Telegram user id is missing.", code="invalid_telegram_data", status=401)
    try:
        telegram_id = int(str(raw_id))
    except ValueError as exc:
        raise APIError("Telegram user id is invalid.", code="invalid_telegram_data", status=401) from exc

    telegram_username = (user_payload.get("username") or data.get("username") or "").strip() or None
    first_name = (user_payload.get("first_name") or data.get("first_name") or "").strip()
    last_name = (user_payload.get("last_name") or data.get("last_name") or "").strip()
    display_name = " ".join(part for part in [first_name, last_name] if part).strip()
    if not display_name:
        display_name = telegram_username or f"tg_{telegram_id}"
    return telegram_id, telegram_username, display_name


@router.post("/register", response=AuthResponse)
@transaction.atomic
def register(request, payload: RegisterIn):
    email, username = _normalize_identifier(payload.email, payload.username)
    fields = {}
    if not email and not username:
        fields["email"] = "Email or username is required."
        fields["username"] = "Email or username is required."
        raise APIError("Missing identifier.", code="validation_error", fields=fields, status=422)

    try:
        validate_password(payload.password)
    except DjangoValidationError as exc:
        fields["password"] = " ".join(exc.messages) if exc.messages else "Password is invalid."
        raise APIError("Validation failed.", code="validation_error", fields=fields, status=422) from exc

    if email and User.objects.filter(email__iexact=email).exists():
        fields["email"] = "Email already exists."
    if username and User.objects.filter(username__iexact=username).exists():
        fields["username"] = "Username already exists."
    if fields:
        raise APIError("Validation failed.", code="validation_error", fields=fields, status=422)

    resolved_username = username or _safe_username_from_email(email or "user")
    user = User(
        username=resolved_username,
        email=email,
        display_name=resolved_username,
    )
    user.set_password(payload.password)
    user.save()

    tokens, _token_record = _issue_tokens(user, request)
    return {**tokens, "user": _serialize_user(user)}


@router.post("/login", response=AuthResponse)
@transaction.atomic
def login(request, payload: LoginIn):
    email, username = _normalize_identifier(payload.email, payload.username)
    user = _authenticate(email, username, payload.password)
    tokens, _token_record = _issue_tokens(user, request)
    return {**tokens, "user": _serialize_user(user)}


@router.post("/refresh", response=RefreshResponse)
@transaction.atomic
def refresh_tokens(request, payload: RefreshIn):
    try:
        decoded = decode_token(payload.refresh, expected_type="refresh")
    except JWTDecodeError as exc:
        raise APIError("Refresh token is invalid.", code="invalid_refresh", status=401) from exc

    token_jti = decoded.get("jti")
    user_id = decoded.get("sub")
    if not token_jti or not user_id:
        raise APIError("Refresh token is invalid.", code="invalid_refresh", status=401)

    token_record = RefreshToken.objects.select_related("user").filter(jti=token_jti, user_id=user_id).first()
    if not token_record:
        raise APIError("Refresh token is invalid.", code="invalid_refresh", status=401)
    if token_record.token_hash != _hash_refresh_token(payload.refresh):
        raise APIError("Refresh token is invalid.", code="invalid_refresh", status=401)
    if token_record.is_revoked:
        raise APIError("Refresh token is revoked.", code="revoked_refresh", status=401)
    if token_record.is_expired:
        _revoke_token(token_record)
        raise APIError("Refresh token has expired.", code="expired_refresh", status=401)

    user = token_record.user
    if not user.is_active:
        _revoke_token(token_record)
        raise APIError("Account is disabled.", code="inactive_user", status=403)

    new_tokens, new_record = _issue_tokens(user, request)
    _revoke_token(token_record, replaced_by=new_record)
    return new_tokens


@router.post("/logout", auth=JWTAuth(), response={204: None})
@transaction.atomic
def logout(request, payload: LogoutIn | None = None):
    now = timezone.now()
    refresh_value = payload.refresh if payload else None
    if refresh_value:
        try:
            decoded = decode_token(refresh_value, expected_type="refresh")
        except JWTDecodeError as exc:
            raise APIError("Refresh token is invalid.", code="invalid_refresh", status=401) from exc
        token_jti = decoded.get("jti")
        token_hash = _hash_refresh_token(refresh_value)
        RefreshToken.objects.filter(user=request.auth, jti=token_jti, token_hash=token_hash, revoked_at__isnull=True).update(
            revoked_at=now
        )
    else:
        RefreshToken.objects.filter(user=request.auth, revoked_at__isnull=True).update(revoked_at=now)
    return 204, None


@router.get("/me", auth=JWTAuth(), response=AuthUserOut)
def current_user(request):
    # Contract: /auth/me returns only id, email, username, displayName
    return _serialize_user(request.auth)


@router.post("/telegram", response=AuthResponse)
@transaction.atomic
def telegram_login(request, payload: TelegramAuthIn):
    verified_data = _verify_telegram_hash(payload.initData)
    telegram_id, telegram_username, display_name = _extract_telegram_user(verified_data)

    user = User.objects.filter(telegram_id=telegram_id).first()
    if not user:
        base_username = telegram_username or f"tg_{telegram_id}"
        user = User(
            username=_safe_username(base_username),
            telegram_id=telegram_id,
            telegram_username=telegram_username or "",
            display_name=display_name,
            is_active=True,
        )
        user.set_unusable_password()
        user.save()
    else:
        update_fields = []
        if telegram_username and user.telegram_username != telegram_username:
            user.telegram_username = telegram_username
            update_fields.append("telegram_username")
        if display_name and user.display_name != display_name:
            user.display_name = display_name
            update_fields.append("display_name")
        if update_fields:
            user.save(update_fields=update_fields)

    tokens, _token_record = _issue_tokens(user, request)
    return {**tokens, "user": _serialize_user(user)}
