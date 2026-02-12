from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from apps.accounts.models import RefreshToken, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Profile", {"fields": ("display_name", "telegram_id", "telegram_username")}),
    )
    list_display = ("id", "username", "email", "display_name", "telegram_id", "is_staff", "is_active")
    search_fields = ("username", "email", "telegram_id")


@admin.register(RefreshToken)
class RefreshTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "jti", "expires_at", "revoked_at", "created_at")
    list_filter = ("revoked_at",)
    search_fields = ("user__username", "user__email", "jti", "token_hash")
