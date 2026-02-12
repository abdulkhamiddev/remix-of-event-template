from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt
from django.conf import settings
from jwt import ExpiredSignatureError, InvalidTokenError


class JWTDecodeError(Exception):
    pass


def _base_payload(user_id: int, token_type: str, lifetime: timedelta) -> dict:
    now = datetime.now(UTC)
    return {
        "sub": str(user_id),
        "token_type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
        "jti": str(uuid4()),
    }


def create_access_token(user_id: int) -> tuple[str, dict]:
    payload = _base_payload(
        user_id=user_id,
        token_type="access",
        lifetime=timedelta(minutes=settings.JWT_ACCESS_TTL_MINUTES),
    )
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, payload


def create_refresh_token(user_id: int) -> tuple[str, dict]:
    payload = _base_payload(
        user_id=user_id,
        token_type="refresh",
        lifetime=timedelta(days=settings.JWT_REFRESH_TTL_DAYS),
    )
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, payload


def decode_token(token: str, expected_type: str | None = None) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except ExpiredSignatureError as exc:
        raise JWTDecodeError("Token expired.") from exc
    except InvalidTokenError as exc:
        raise JWTDecodeError("Token is invalid.") from exc

    if expected_type and payload.get("token_type") != expected_type:
        raise JWTDecodeError("Token type mismatch.")
    return payload
