import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    email = models.EmailField(unique=True, null=True, blank=True)
    phone = models.CharField(max_length=32, unique=True, null=True, blank=True)
    display_name = models.CharField(max_length=150, blank=True)
    telegram_id = models.BigIntegerField(unique=True, null=True, blank=True)
    telegram_username = models.CharField(max_length=150, blank=True)

    def __str__(self) -> str:
        return self.email or self.username


class RefreshToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="refresh_tokens")
    jti = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    token_hash = models.CharField(max_length=64, unique=True, null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    replaced_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="replaces",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "revoked_at"]),
            models.Index(fields=["expires_at"]),
        ]

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()

    @property
    def is_active(self) -> bool:
        return not self.is_revoked and not self.is_expired

    def __str__(self) -> str:
        return f"{self.user_id}:{self.jti}"


class TelegramMagicLink(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="telegram_magic_links",
        null=True,
        blank=True,
    )
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    telegram_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    telegram_username = models.CharField(max_length=150, blank=True, default="")
    telegram_first_name = models.CharField(max_length=150, blank=True, default="")
    phone = models.CharField(max_length=32, blank=True, default="", db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"], name="accounts_te_user_id_4c9eb4_idx"),
            models.Index(fields=["created_at"], name="accounts_te_created_fa9a38_idx"),
        ]

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()

    @property
    def is_used(self) -> bool:
        return self.used_at is not None

    def __str__(self) -> str:
        return f"{self.user_id or self.telegram_id}:{self.created_at.isoformat()}"


def _default_password_reset_expiry():
    return timezone.now() + timedelta(minutes=15)


class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="password_reset_tokens")
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_default_password_reset_expiry, db_index=True)
    used_at = models.DateTimeField(null=True, blank=True)
    requested_ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["expires_at"]),
        ]

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()

    @property
    def is_used(self) -> bool:
        return self.used_at is not None
