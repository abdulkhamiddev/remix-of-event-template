from __future__ import annotations

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.accounts.models import PasswordResetToken, RefreshToken, TelegramMagicLink


class Command(BaseCommand):
    help = "Delete old/expired auth artifacts (password reset tokens, telegram magic links, revoked refresh tokens)."

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Delete eligible records older than N days (default: 30).",
        )

    def handle(self, *args, **options) -> None:
        days = int(options.get("days") or 30)
        if days < 1:
            days = 1

        now = timezone.now()
        cutoff = now - timedelta(days=days)

        reset_qs = PasswordResetToken.objects.filter(created_at__lt=cutoff).filter(
            Q(used_at__isnull=False) | Q(expires_at__lt=now)
        )
        reset_deleted, _ = reset_qs.delete()

        magic_qs = TelegramMagicLink.objects.filter(created_at__lt=cutoff).filter(
            Q(used_at__isnull=False) | Q(expires_at__lt=now)
        )
        magic_deleted, _ = magic_qs.delete()

        refresh_qs = RefreshToken.objects.filter(revoked_at__isnull=False, revoked_at__lt=cutoff)
        refresh_deleted, _ = refresh_qs.delete()

        self.stdout.write(
            self.style.SUCCESS(
                f"cleanup_tokens: deleted PasswordResetToken={reset_deleted}, TelegramMagicLink={magic_deleted}, RefreshToken={refresh_deleted} (cutoff={cutoff.isoformat()})"
            )
        )
