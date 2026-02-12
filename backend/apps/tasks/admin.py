from django.contrib import admin

from apps.tasks.models import Category, Task, TaskOccurrence, UserSettings


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "name", "is_default", "updated_at")
    search_fields = ("name", "user__username", "user__email")
    list_filter = ("is_default",)


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("id", "owner", "title", "status", "priority", "scheduled_date", "due_date", "updated_at")
    search_fields = ("title", "description", "owner__username", "owner__email")
    list_filter = ("status", "priority", "has_deadline", "has_timer", "is_recurring")
    autocomplete_fields = ("owner", "category")


@admin.register(UserSettings)
class UserSettingsAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "theme",
        "sidebar_collapsed",
        "animation_intensity",
        "min_daily_tasks",
        "streak_threshold_percent",
        "updated_at",
    )


@admin.register(TaskOccurrence)
class TaskOccurrenceAdmin(admin.ModelAdmin):
    list_display = ("id", "task", "date", "status", "completed_at", "timer_seconds")
    list_filter = ("status", "date")
    search_fields = ("task__title", "task__owner__username", "task__owner__email")
