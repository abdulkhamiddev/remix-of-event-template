import hashlib
import secrets

from django.conf import settings
from django.core.mail import send_mail


def generate_reset_token() -> str:
    return secrets.token_urlsafe(48)


def hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_reset_link(raw_token: str) -> str:
    base_url = settings.PUBLIC_APP_URL.rstrip("/")
    return f"{base_url}/reset-password?token={raw_token}"


def send_reset_email(user, link: str) -> None:
    subject = "Reset your TaskFlow password"
    body = (
        "You requested a password reset for your TaskFlow account.\n\n"
        f"Reset link: {link}\n\n"
        f"This link expires in {settings.PASSWORD_RESET_TTL_MINUTES} minutes and can be used once."
    )
    recipient = user.email
    if not recipient:
        return

    send_mail(
        subject=subject,
        message=body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient],
        fail_silently=False,
    )

    if settings.EMAIL_BACKEND == "django.core.mail.backends.console.EmailBackend":
        print(f"[password-reset] {recipient}: {link}")
