from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import RefreshToken, TelegramMagicLink, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Profile", {"fields": ("display_name", "phone", "telegram_id", "telegram_username")}),
    )
    list_display = ("id", "username", "email", "phone", "display_name", "telegram_id", "is_staff", "is_active")
    search_fields = ("username", "email", "phone", "telegram_id", "telegram_username")
    list_filter = ("is_staff", "is_active", "is_superuser")


@admin.register(RefreshToken)
class RefreshTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "jti", "expires_at", "revoked_at", "created_at")
    list_filter = ("revoked_at",)
    search_fields = ("user__username", "user__email", "jti", "token_hash")
    readonly_fields = ("jti", "token_hash", "expires_at", "revoked_at", "created_at", "user_agent", "ip_address")


@admin.register(TelegramMagicLink)
class TelegramMagicLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "telegram_id", "telegram_username", "phone", "expires_at", "used_at", "created_at")
    list_filter = ("used_at", "expires_at", "created_at")
    search_fields = ("user__username", "user__email", "phone", "telegram_id", "telegram_username", "token_hash")
    readonly_fields = (
        "token_hash",
        "expires_at",
        "used_at",
        "telegram_id",
        "telegram_username",
        "telegram_first_name",
        "phone",
        "created_at",
    )
