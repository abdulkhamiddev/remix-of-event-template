from django.contrib.auth import get_user_model
from ninja import Router

from apps.auth.jwt_auth import TokenError, decode_token, issue_token_pair, jwt_auth
from apps.auth.schemas import (
    AuthResponseSchema,
    AuthUserSchema,
    IdentifierPasswordSchema,
    MessageSchema,
    RefreshResponseSchema,
    RefreshSchema,
)

router = Router(tags=["auth"])
User = get_user_model()


def _normalize_username(raw: str) -> str:
    return "".join(ch for ch in raw if ch.isalnum() or ch in {"_", "-", "."})[:150] or "user"


def _build_unique_username(base: str) -> str:
    username = _normalize_username(base)
    if not User.objects.filter(username__iexact=username).exists():
        return username

    counter = 1
    while True:
        candidate = f"{username}{counter}"
        if not User.objects.filter(username__iexact=candidate).exists():
            return candidate
        counter += 1


def _resolve_login_user(payload: IdentifierPasswordSchema):
    if payload.email:
        return User.objects.filter(email__iexact=payload.email.strip()).order_by("id").first()
    if payload.username:
        return User.objects.filter(username__iexact=payload.username.strip()).order_by("id").first()
    return None


@router.post("/login", response={200: AuthResponseSchema, 401: MessageSchema})
def login(request, payload: IdentifierPasswordSchema):
    user = _resolve_login_user(payload)
    if not user or not user.check_password(payload.password):
        return 401, {"detail": "Invalid credentials."}
    if not user.is_active:
        return 401, {"detail": "User account is disabled."}

    access, refresh = issue_token_pair(user.id)
    return {"access": access, "refresh": refresh, "user": user}


@router.post("/register", response={200: AuthResponseSchema, 400: MessageSchema})
def register(request, payload: IdentifierPasswordSchema):
    email = payload.email.strip().lower() if payload.email else ""
    username = payload.username.strip() if payload.username else ""

    if email and User.objects.filter(email__iexact=email).exists():
        return 400, {"detail": "Email is already in use."}

    if username and User.objects.filter(username__iexact=username).exists():
        return 400, {"detail": "Username is already in use."}

    if not username:
        base = email.split("@", 1)[0] if email else "user"
        username = _build_unique_username(base)
    else:
        username = _normalize_username(username)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=payload.password,
    )

    access, refresh = issue_token_pair(user.id)
    return {"access": access, "refresh": refresh, "user": user}


@router.post("/refresh", response={200: RefreshResponseSchema, 401: MessageSchema})
def refresh(request, payload: RefreshSchema):
    try:
        token_payload = decode_token(payload.refresh, expected_type="refresh")
    except TokenError as exc:
        return 401, {"detail": str(exc)}

    user_id = token_payload.get("sub")
    user = User.objects.filter(id=user_id, is_active=True).first()
    if not user:
        return 401, {"detail": "Invalid token subject."}

    access, refresh_token = issue_token_pair(user.id)
    return {"access": access, "refresh": refresh_token}


@router.get("/me", response={200: AuthUserSchema}, auth=jwt_auth)
def me(request):
    return request.auth
