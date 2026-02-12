from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from ninja.security import HttpBearer

ALGORITHM = "HS256"


class TokenError(Exception):
    pass


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _encode_token(user_id: int, token_type: str, ttl: timedelta) -> str:
    now = _utc_now()
    payload = {
        "sub": str(user_id),
        "type": token_type,
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(user_id: int) -> str:
    ttl = timedelta(minutes=getattr(settings, "JWT_ACCESS_MINUTES", 30))
    return _encode_token(user_id=user_id, token_type="access", ttl=ttl)


def create_refresh_token(user_id: int) -> str:
    ttl = timedelta(days=getattr(settings, "JWT_REFRESH_DAYS", 7))
    return _encode_token(user_id=user_id, token_type="refresh", ttl=ttl)


def issue_token_pair(user_id: int) -> tuple[str, str]:
    return create_access_token(user_id), create_refresh_token(user_id)


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM],
            options={"require": ["sub", "type", "exp"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise TokenError("Invalid token.") from exc

    token_type = payload.get("type")
    if token_type != expected_type:
        raise TokenError("Invalid token type.")

    return payload


class JWTAuth(HttpBearer):
    def authenticate(self, request, token: str):
        try:
            payload = decode_token(token, expected_type="access")
        except TokenError:
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        user = get_user_model().objects.filter(id=user_id, is_active=True).first()
        if not user:
            return None

        request.auth_payload = payload
        return user


jwt_auth = JWTAuth()
