import hashlib
import hmac
import json
import time
from datetime import UTC, datetime, timedelta
from uuid import UUID
from urllib.parse import parse_qsl

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django_redis import get_redis_connection
from ninja import Router

from apps.accounts.models import PasswordResetToken, RefreshToken
from apps.accounts.password_reset import build_reset_link, generate_reset_token, hash_reset_token, send_reset_email
from apps.accounts.schemas import (
    AuthResponse,
    AuthUserOut,
    DetailResponse,
    ForgotPasswordIn,
    LoginIn,
    LogoutIn,
    ResetPasswordIn,
    RefreshIn,
    RefreshResponse,
    RegisterIn,
    TelegramAuthIn,
    TelegramMagicIn,
)
from apps.accounts.telegram_magic import consume_magic_token, get_magic_link_limit_metadata
from apps.accounts.telegram_notify import send_login_success_message
from apps.common.auth import JWTAuth
from apps.common.exceptions import APIError
from apps.common.ip import request_ip
from apps.common.jwt import JWTDecodeError, create_access_token, create_refresh_token, decode_token
from apps.common.rate_limit import RateLimitRule, rate_limit_rules

router = Router(tags=["auth"])
User = get_user_model()


def _cookie_samesite(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"strict", "lax", "none"}:
        return normalized.title()
    return "Lax"


def _set_refresh_cookies(response, *, refresh_token: str, refresh_jti: str) -> None:
    # Refresh token cookie: HttpOnly, narrow path, used only for /api/auth/refresh rotation.
    max_age = max(1, int(settings.JWT_REFRESH_TTL_DAYS)) * 86400
    secure = bool(getattr(settings, "AUTH_COOKIE_SECURE", not settings.DEBUG))
    samesite = _cookie_samesite(getattr(settings, "AUTH_COOKIE_SAMESITE", "Lax"))

    response.set_cookie(
        settings.AUTH_REFRESH_COOKIE_NAME,
        refresh_token,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/api/auth/refresh",
    )

    # Session id cookie: allows logout to revoke the current refresh session without exposing refresh token to JS.
    response.set_cookie(
        settings.AUTH_REFRESH_SESSION_COOKIE_NAME,
        refresh_jti,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/api/auth",
    )


def _clear_refresh_cookies(response) -> None:
    response.delete_cookie(settings.AUTH_REFRESH_COOKIE_NAME, path="/api/auth/refresh")
    response.delete_cookie(settings.AUTH_REFRESH_SESSION_COOKIE_NAME, path="/api/auth")


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


def _serialize_user_json(user) -> dict:
    """
    JsonResponse cannot serialize Ninja/Pydantic schema objects directly.
    Keep _serialize_user() for Ninja response models, but use this helper
    whenever returning a Django JsonResponse.
    """
    out = _serialize_user(user)
    if hasattr(out, "model_dump"):
        return out.model_dump()  # pydantic v2
    if hasattr(out, "dict"):
        return out.dict()  # pydantic v1 fallback
    # Defensive fallback; should not happen.
    return {"id": str(getattr(user, "id", ""))}


def _stable_password_error_code(django_code: str) -> str:
    mapping = {
        "password_too_short": "min_length",
        "password_too_common": "common_password",
        "password_entirely_numeric": "numeric_only",
        "password_too_similar": "too_similar",
    }
    return mapping.get(django_code, "invalid")


def _stable_password_error_message(django_code: str, params: dict, fallback: str) -> str:
    if django_code == "password_too_short":
        min_length = int(params.get("min_length", 8) or 8)
        return f"Password must be at least {min_length} characters."
    if django_code == "password_too_common":
        return "Password is too common."
    if django_code == "password_entirely_numeric":
        return "Password cannot be entirely numeric."
    if django_code == "password_too_similar":
        return "Password is too similar to your account information."
    return fallback or "Password is invalid."


def _serialize_password_validation_errors(exc: DjangoValidationError) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    for err in getattr(exc, "error_list", []) or []:
        django_code = str(getattr(err, "code", "") or "")
        params = getattr(err, "params", {}) or {}
        fallback = err.messages[0] if getattr(err, "messages", None) else "Password is invalid."
        items.append(
            {
                "code": _stable_password_error_code(django_code),
                "message": _stable_password_error_message(django_code, params, fallback),
            }
        )

    if not items:
        for message in getattr(exc, "messages", []) or []:
            items.append({"code": "invalid", "message": str(message)})
    if not items:
        items.append({"code": "invalid", "message": "Password is invalid."})
    return items


def _resolve_display_name(first_name: str | None, username: str | None, telegram_id: int) -> str:
    first = (first_name or "").strip()
    if first:
        return first
    user_name = (username or "").strip()
    if user_name:
        return user_name
    return f"tg_{telegram_id}"


def _get_or_create_user_from_magic_link(link) -> User:
    if link.user_id:
        return link.user

    telegram_id = link.telegram_id
    if not telegram_id:
        raise APIError("Login link is invalid.", code="invalid_magic_link", status=401)

    telegram_username = (link.telegram_username or "").strip() or None
    display_name = _resolve_display_name(link.telegram_first_name, telegram_username, int(telegram_id))
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

    link.user = user
    link.save(update_fields=["user"])
    return user


def _request_meta(request) -> tuple[str, str]:
    user_agent = request.headers.get("user-agent", "")[:255]
    return user_agent, request_ip(request)


def _hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _payload_from_args(args: tuple[object, ...], kwargs: dict[str, object], key: str):
    if key in kwargs:
        return kwargs.get(key)
    if args:
        return args[0]
    return None


def _rate_key_ip(request, _args: tuple[object, ...], _kwargs: dict[str, object]) -> str:
    return request_ip(request)


def _rate_key_login_identifier(request, args: tuple[object, ...], kwargs: dict[str, object]) -> str | None:
    payload = _payload_from_args(args, kwargs, "payload")
    if not payload:
        return None
    email, username = _normalize_identifier(getattr(payload, "email", None), getattr(payload, "username", None))
    if email:
        return f"email:{email}"
    if username:
        return f"username:{username.strip().lower()}"
    return None


def _rate_key_forgot_identifier(request, args: tuple[object, ...], kwargs: dict[str, object]) -> str | None:
    payload = _payload_from_args(args, kwargs, "payload")
    if not payload:
        return None
    raw = (getattr(payload, "emailOrUsername", "") or "").strip()
    if not raw:
        return None
    if "@" in raw:
        return f"email:{raw.lower()}"
    return f"username:{raw.lower()}"


def _rate_key_refresh_user_or_ip(request, args: tuple[object, ...], kwargs: dict[str, object]) -> str:
    payload = _payload_from_args(args, kwargs, "payload")
    refresh_value = getattr(payload, "refresh", None) if payload else None
    if not refresh_value:
        return request_ip(request)
    try:
        decoded = decode_token(refresh_value, expected_type="refresh")
    except JWTDecodeError:
        return request_ip(request)
    user_id = decoded.get("sub")
    if user_id:
        return f"user:{user_id}"
    return request_ip(request)


def _get_magic_limit_metadata_cached(request, args: tuple[object, ...], kwargs: dict[str, object]):
    cached = getattr(request, "_magic_limit_metadata", None)
    if cached is not None:
        return cached
    payload = _payload_from_args(args, kwargs, "payload")
    token = getattr(payload, "token", None) if payload else None
    if not token:
        metadata = get_magic_link_limit_metadata("")
    else:
        metadata = get_magic_link_limit_metadata(token)
    setattr(request, "_magic_limit_metadata", metadata)
    return metadata


def _rate_key_magic_telegram_id(request, args: tuple[object, ...], kwargs: dict[str, object]) -> str | None:
    metadata = _get_magic_limit_metadata_cached(request, args, kwargs)
    if metadata.telegram_id is None:
        return None
    return f"{metadata.telegram_id}"


def _rate_key_magic_phone(request, args: tuple[object, ...], kwargs: dict[str, object]) -> str | None:
    metadata = _get_magic_limit_metadata_cached(request, args, kwargs)
    return metadata.phone


def _find_user_by_identifier(identifier: str):
    candidate = (identifier or "").strip()
    if not candidate:
        return None
    if "@" in candidate:
        return User.objects.filter(email__iexact=candidate.lower()).first()
    return User.objects.filter(username__iexact=candidate).first()


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
    return {"access": access, "refresh": refresh, "refresh_jti": str(refresh_payload["jti"])}, token_record


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
    parsed["_hash"] = incoming_hash
    return parsed


def _enforce_telegram_widget_freshness_and_replay(verified_data: dict[str, str]) -> None:
    # Telegram includes an auth_date unix timestamp; treat old payloads as invalid to reduce replay window.
    max_age = max(1, int(getattr(settings, "TELEGRAM_AUTH_MAX_AGE_SECONDS", 120)))
    auth_date_raw = (verified_data.get("auth_date") or "").strip()
    if not auth_date_raw:
        raise APIError("Telegram auth_date is missing.", code="invalid_telegram_data", status=401)
    try:
        auth_ts = int(auth_date_raw)
    except ValueError as exc:
        raise APIError("Telegram auth_date is invalid.", code="invalid_telegram_data", status=401) from exc

    now_ts = int(time.time())
    # Allow small clock skew; reject future-dated payloads.
    if auth_ts > now_ts + 30 or (now_ts - auth_ts) > max_age:
        raise APIError("telegram_auth_stale", code="telegram_auth_stale", status=401)

    incoming_hash = (verified_data.get("_hash") or "").strip()
    if not incoming_hash:
        raise APIError("Telegram auth hash is missing.", code="invalid_telegram_data", status=401)

    # Replay protection: the Telegram signature is stable per payload; mark as seen for max_age seconds.
    key = f"tg_auth_seen:{incoming_hash}"
    try:
        redis = get_redis_connection("default")
        created = redis.set(key, "1", nx=True, ex=max_age)
    except Exception as exc:
        raise APIError("telegram_auth_unavailable", code="telegram_auth_unavailable", status=503) from exc
    if not created:
        raise APIError("telegram_auth_replay", code="telegram_auth_replay", status=401)


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
@rate_limit_rules(
    "auth_register",
    [RateLimitRule(name="ip", rate=settings.AUTH_REGISTER_RATE, key_func=_rate_key_ip)],
    methods=("POST",),
)
@transaction.atomic
def register(request, payload: RegisterIn):
    email, username = _normalize_identifier(payload.email, payload.username)
    fields = {}
    if not email and not username:
        fields["email"] = "Email or username is required."
        fields["username"] = "Email or username is required."
        raise APIError("Missing identifier.", code="validation_error", fields=fields, status=422)

    similarity_username = (username or (email.split("@", 1)[0] if email else "") or "user").strip() or "user"
    password_validation_user = User(
        username=similarity_username,
        email=email or None,
    )
    try:
        validate_password(payload.password, user=password_validation_user)
    except DjangoValidationError as exc:
        raise APIError(
            "Validation failed.",
            code="password_invalid",
            status=422,
            fields={"password": _serialize_password_validation_errors(exc)},
        ) from exc

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
    response_payload: dict = {"access": tokens["access"], "user": _serialize_user_json(user)}
    if getattr(settings, "AUTH_RETURN_REFRESH_IN_BODY", False):
        response_payload["refresh"] = tokens["refresh"]
    response = JsonResponse(response_payload, status=200)
    _set_refresh_cookies(response, refresh_token=tokens["refresh"], refresh_jti=tokens["refresh_jti"])
    return response


@router.post("/login", response=AuthResponse)
@rate_limit_rules(
    "auth_login",
    [
        RateLimitRule(name="ip", rate=settings.AUTH_LOGIN_RATE, key_func=_rate_key_ip),
        RateLimitRule(name="identifier", rate=settings.AUTH_LOGIN_IDENTIFIER_RATE, key_func=_rate_key_login_identifier),
    ],
    methods=("POST",),
)
@transaction.atomic
def login(request, payload: LoginIn):
    email, username = _normalize_identifier(payload.email, payload.username)
    user = _authenticate(email, username, payload.password)
    tokens, _token_record = _issue_tokens(user, request)
    response_payload: dict = {"access": tokens["access"], "user": _serialize_user_json(user)}
    if getattr(settings, "AUTH_RETURN_REFRESH_IN_BODY", False):
        response_payload["refresh"] = tokens["refresh"]
    response = JsonResponse(response_payload, status=200)
    _set_refresh_cookies(response, refresh_token=tokens["refresh"], refresh_jti=tokens["refresh_jti"])
    return response


@router.post("/refresh", response=RefreshResponse)
@rate_limit_rules(
    "auth_refresh",
    [RateLimitRule(name="user_or_ip", rate=settings.AUTH_REFRESH_RATE, key_func=_rate_key_refresh_user_or_ip)],
    methods=("POST",),
)
@transaction.atomic
def refresh_tokens(request, payload: RefreshIn | None = None):
    refresh_value = payload.refresh if payload and payload.refresh else None
    if not refresh_value:
        refresh_value = request.COOKIES.get(settings.AUTH_REFRESH_COOKIE_NAME) or None
    if not refresh_value:
        response = JsonResponse({"detail": "no_refresh", "code": "no_refresh", "fields": {}}, status=401)
        _clear_refresh_cookies(response)
        return response

    try:
        decoded = decode_token(refresh_value, expected_type="refresh")
    except JWTDecodeError:
        response = JsonResponse({"detail": "invalid_refresh", "code": "invalid_refresh", "fields": {}}, status=401)
        _clear_refresh_cookies(response)
        return response

    token_jti = decoded.get("jti")
    user_id = decoded.get("sub")
    if not token_jti or not user_id:
        response = JsonResponse({"detail": "invalid_refresh", "code": "invalid_refresh", "fields": {}}, status=401)
        _clear_refresh_cookies(response)
        return response

    token_record = RefreshToken.objects.select_related("user").filter(jti=token_jti, user_id=user_id).first()
    if not token_record:
        response = JsonResponse({"detail": "invalid_refresh", "code": "invalid_refresh", "fields": {}}, status=401)
        _clear_refresh_cookies(response)
        return response
    if token_record.token_hash != _hash_refresh_token(refresh_value):
        response = JsonResponse({"detail": "invalid_refresh", "code": "invalid_refresh", "fields": {}}, status=401)
        _clear_refresh_cookies(response)
        return response
    if token_record.is_revoked or token_record.replaced_by_id is not None:
        # Treat reuse of rotated/revoked refresh tokens as a compromise indicator.
        RefreshToken.objects.filter(user_id=user_id, revoked_at__isnull=True).update(revoked_at=timezone.now())
        response = JsonResponse({"detail": "refresh_reuse", "code": "refresh_reuse", "fields": {}}, status=401)
        _clear_refresh_cookies(response)
        return response
    if token_record.is_expired:
        _revoke_token(token_record)
        response = JsonResponse({"detail": "expired_refresh", "code": "expired_refresh", "fields": {}}, status=401)
        _clear_refresh_cookies(response)
        return response

    user = token_record.user
    if not user.is_active:
        _revoke_token(token_record)
        response = JsonResponse({"detail": "inactive_user", "code": "inactive_user", "fields": {}}, status=403)
        _clear_refresh_cookies(response)
        return response

    new_tokens, new_record = _issue_tokens(user, request)
    _revoke_token(token_record, replaced_by=new_record)

    response_payload: dict = {"access": new_tokens["access"]}
    if getattr(settings, "AUTH_RETURN_REFRESH_IN_BODY", False):
        response_payload["refresh"] = new_tokens["refresh"]
    response = JsonResponse(response_payload, status=200)
    _set_refresh_cookies(response, refresh_token=new_tokens["refresh"], refresh_jti=new_tokens["refresh_jti"])
    return response


@router.post("/logout", auth=JWTAuth(), response={204: None})
@transaction.atomic
def logout(request, payload: LogoutIn | None = None):
    rsid = (request.COOKIES.get(settings.AUTH_REFRESH_SESSION_COOKIE_NAME) or "").strip()
    if rsid:
        RefreshToken.objects.filter(user=request.auth, jti=rsid, revoked_at__isnull=True).update(revoked_at=timezone.now())
    elif payload and payload.refresh:
        try:
            decoded = decode_token(payload.refresh, expected_type="refresh")
        except JWTDecodeError as exc:
            raise APIError("Refresh token is invalid.", code="invalid_refresh", status=401) from exc
        token_jti = decoded.get("jti")
        token_hash = _hash_refresh_token(payload.refresh)
        RefreshToken.objects.filter(user=request.auth, jti=token_jti, token_hash=token_hash, revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )

    response = JsonResponse({}, status=204)
    _clear_refresh_cookies(response)
    return response


@router.post("/logout-all", auth=JWTAuth(), response={204: None})
@transaction.atomic
def logout_all(request):
    RefreshToken.objects.filter(user=request.auth, revoked_at__isnull=True).update(revoked_at=timezone.now())
    response = JsonResponse({}, status=204)
    _clear_refresh_cookies(response)
    return response


@router.get("/me", auth=JWTAuth(), response=AuthUserOut)
def current_user(request):
    # Contract: /auth/me returns only id, email, username, displayName
    return _serialize_user(request.auth)


@router.post("/telegram/magic", response=AuthResponse)
@rate_limit_rules(
    "auth_telegram_magic",
    [
        RateLimitRule(name="ip", rate=settings.TELEGRAM_MAGIC_RATE, key_func=_rate_key_ip),
        RateLimitRule(name="telegram_id", rate=settings.TELEGRAM_MAGIC_RATE, key_func=_rate_key_magic_telegram_id),
        RateLimitRule(name="phone", rate=settings.TELEGRAM_MAGIC_RATE, key_func=_rate_key_magic_phone),
    ],
    methods=("POST",),
)
@transaction.atomic
def telegram_magic_login(request, payload: TelegramMagicIn):
    link = consume_magic_token(payload.token)
    user = _get_or_create_user_from_magic_link(link)
    if not user.is_active:
        raise APIError("Account is disabled.", code="inactive_user", status=403)

    tokens, _token_record = _issue_tokens(user, request)
    telegram_id = link.telegram_id or user.telegram_id
    if telegram_id:
        send_login_success_message(int(telegram_id))
    response_payload: dict = {"access": tokens["access"], "user": _serialize_user_json(user)}
    if getattr(settings, "AUTH_RETURN_REFRESH_IN_BODY", False):
        response_payload["refresh"] = tokens["refresh"]
    response = JsonResponse(response_payload, status=200)
    _set_refresh_cookies(response, refresh_token=tokens["refresh"], refresh_jti=tokens["refresh_jti"])
    return response


@router.post("/telegram", response=AuthResponse)
@rate_limit_rules(
    "auth_telegram_widget",
    [RateLimitRule(name="ip", rate=settings.TELEGRAM_MAGIC_RATE, key_func=_rate_key_ip)],
    methods=("POST",),
)
@transaction.atomic
def telegram_login(request, payload: TelegramAuthIn):
    verified_data = _verify_telegram_hash(payload.initData)
    _enforce_telegram_widget_freshness_and_replay(verified_data)
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
    response_payload: dict = {"access": tokens["access"], "user": _serialize_user_json(user)}
    if getattr(settings, "AUTH_RETURN_REFRESH_IN_BODY", False):
        response_payload["refresh"] = tokens["refresh"]
    response = JsonResponse(response_payload, status=200)
    _set_refresh_cookies(response, refresh_token=tokens["refresh"], refresh_jti=tokens["refresh_jti"])
    return response


@router.post("/forgot-password", response=DetailResponse)
@rate_limit_rules(
    "auth_forgot_password",
    [
        RateLimitRule(name="ip", rate=settings.AUTH_FORGOT_RATE, key_func=_rate_key_ip),
        RateLimitRule(name="identifier", rate=settings.AUTH_FORGOT_IDENTIFIER_RATE, key_func=_rate_key_forgot_identifier),
    ],
    methods=("POST",),
)
@transaction.atomic
def forgot_password(request, payload: ForgotPasswordIn):
    user = _find_user_by_identifier(payload.emailOrUsername)
    if user and user.is_active and user.email:
        raw_token = generate_reset_token()
        PasswordResetToken.objects.create(
            user=user,
            token_hash=hash_reset_token(raw_token),
            expires_at=timezone.now() + timedelta(minutes=settings.PASSWORD_RESET_TTL_MINUTES),
            requested_ip=request_ip(request),
        )
        link = build_reset_link(raw_token)
        try:
            send_reset_email(user, link)
        except Exception:
            # Keep a generic response to avoid account enumeration or provider leakage.
            pass
    return {"detail": "if_account_exists_email_sent"}


@router.post("/reset-password", response=DetailResponse)
@rate_limit_rules(
    "auth_reset_password",
    [RateLimitRule(name="ip", rate=settings.AUTH_RESET_RATE, key_func=_rate_key_ip)],
    methods=("POST",),
)
@transaction.atomic
def reset_password(request, payload: ResetPasswordIn):
    token_hash = hash_reset_token(payload.token)
    reset_token = PasswordResetToken.objects.select_related("user").filter(token_hash=token_hash).first()
    if not reset_token:
        raise APIError("token_invalid", code="token_invalid", status=401)
    if reset_token.is_used:
        raise APIError("token_used", code="token_used", status=401)
    if reset_token.is_expired:
        raise APIError("token_expired", code="token_expired", status=401)

    try:
        validate_password(payload.newPassword, user=reset_token.user)
    except DjangoValidationError as exc:
        raise APIError(
            "Validation failed.",
            code="validation_error",
            status=422,
            fields={"newPassword": " ".join(exc.messages) if exc.messages else "Password is invalid."},
        ) from exc

    user = reset_token.user
    user.set_password(payload.newPassword)
    user.save(update_fields=["password"])
    reset_token.used_at = timezone.now()
    reset_token.save(update_fields=["used_at"])

    # Security: password reset is an account recovery event; revoke sessions and invalidate other reset tokens.
    RefreshToken.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())
    PasswordResetToken.objects.filter(user=user, used_at__isnull=True).exclude(id=reset_token.id).update(used_at=timezone.now())
    response = JsonResponse({"detail": "password_reset_ok"}, status=200)
    _clear_refresh_cookies(response)
    return response
