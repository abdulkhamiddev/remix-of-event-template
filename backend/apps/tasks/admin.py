from django.contrib import admin
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import reverse

from apps.tasks.models import Category, Task, TaskOccurrence, UserSettings

User = get_user_model()


class UserFirstDrilldownMixin:
    user_filter_key: str = ""
    user_count_field: str = ""
    user_select_template: str = ""

    def _build_user_rows(self, request):
        counts = dict(
            self.model.objects.values(self.user_count_field)
            .exclude(**{f"{self.user_count_field}__isnull": True})
            .annotate(total=Count("id"))
            .values_list(self.user_count_field, "total")
        )

        if not counts:
            return []

        users = User.objects.filter(id__in=counts.keys()).order_by("username", "email")
        rows = []
        for user in users:
            label = user.username or user.email or f"User {user.pk}"
            rows.append(
                {
                    "id": user.id,
                    "label": label,
                    "count": counts.get(user.id, 0),
                    "view_url": f"{request.path}?{self.user_filter_key}={user.id}",
                }
            )
        return rows

    def _render_user_select(self, request):
        context = {
            **self.admin_site.each_context(request),
            "opts": self.model._meta,
            "title": f"Select user for {self.model._meta.verbose_name_plural}",
            "rows": self._build_user_rows(request),
            "changelist_url": request.path,
            "add_url": reverse(
                f"admin:{self.model._meta.app_label}_{self.model._meta.model_name}_add",
                current_app=self.admin_site.name,
            ),
            "user_filter_key": self.user_filter_key,
        }
        return TemplateResponse(request, self.user_select_template, context)


@admin.register(Category)
class CategoryAdmin(UserFirstDrilldownMixin, admin.ModelAdmin):
    user_filter_key = "user__id__exact"
    user_count_field = "user_id"
    user_select_template = "admin/tasks/category_user_select.html"

    list_display = ("id", "user", "name", "is_default", "updated_at")
    search_fields = ("name", "user__username", "user__email")
    list_filter = ("is_default", "user")
    readonly_fields = ("created_at", "updated_at")

    def changelist_view(self, request, extra_context=None):
        if not request.GET.get(self.user_filter_key):
            return self._render_user_select(request)
        return super().changelist_view(request, extra_context=extra_context)


@admin.register(Task)
class TaskAdmin(UserFirstDrilldownMixin, admin.ModelAdmin):
    user_filter_key = "user__id__exact"
    user_count_field = "owner_id"
    user_select_template = "admin/tasks/task_user_select.html"

    list_display = ("id", "owner", "title", "status", "priority", "scheduled_date", "due_date", "updated_at")
    search_fields = ("title", "description", "owner__username", "owner__email")
    list_filter = ("owner", "status", "priority", "has_deadline", "has_timer", "is_recurring")
    autocomplete_fields = ("owner", "category")
    readonly_fields = ("created_at", "updated_at", "due_date")

    def changelist_view(self, request, extra_context=None):
        owner_filter_key = "owner__id__exact"
        if request.GET.get(self.user_filter_key) and not request.GET.get(owner_filter_key):
            query = request.GET.copy()
            query[owner_filter_key] = request.GET.get(self.user_filter_key)
            query.pop(self.user_filter_key, None)
            return HttpResponseRedirect(f"{request.path}?{query.urlencode()}")

        if not request.GET.get(owner_filter_key):
            return self._render_user_select(request)
        return super().changelist_view(request, extra_context=extra_context)


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
    readonly_fields = ("task", "date", "status", "completed_at", "timer_seconds", "timer_running_since")
