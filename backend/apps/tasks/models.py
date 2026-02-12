from datetime import UTC, datetime

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Category(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=120)
    color = models.CharField(max_length=32, blank=True)
    icon = models.CharField(max_length=64, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_category_name_per_user"),
        ]

    def __str__(self) -> str:
        return self.name


class Task(models.Model):
    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"

    class RecurringPattern(models.TextChoices):
        DAILY = "daily", "Daily"
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"
        CUSTOM = "custom", "Custom"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="tasks", null=True, blank=True)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)

    scheduled_date = models.DateField(db_index=True)
    has_deadline = models.BooleanField(default=False)
    deadline_time = models.TimeField(null=True, blank=True)
    due_date = models.DateTimeField(null=True, blank=True, db_index=True)

    has_timer = models.BooleanField(default=False)
    timer_duration_seconds = models.PositiveIntegerField(default=0)
    timer_total_seconds = models.PositiveIntegerField(default=0)
    timer_running_since = models.DateTimeField(null=True, blank=True)

    is_recurring = models.BooleanField(default=False)
    recurring_pattern = models.CharField(max_length=10, choices=RecurringPattern.choices, null=True, blank=True)
    custom_days = models.JSONField(default=list, blank=True)
    next_occurrence_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-scheduled_date", "-created_at"]

    def __str__(self) -> str:
        return self.title

    def _build_due_date(self) -> datetime | None:
        if not self.has_deadline or not self.deadline_time:
            return None
        combined = datetime.combine(self.scheduled_date, self.deadline_time, tzinfo=UTC)
        return combined

    def clean(self):
        errors = {}
        if self.status == Task.Status.COMPLETED and self.completed_at is None:
            errors["completed_at"] = "completed_at is required when status is completed."
        if self.status != Task.Status.COMPLETED and self.completed_at is not None:
            errors["completed_at"] = "completed_at must be empty when status is pending."
        if self.has_deadline and self.deadline_time is None:
            errors["deadline_time"] = "deadline_time is required when has_deadline is true."
        if not self.has_deadline and self.deadline_time is not None:
            errors["deadline_time"] = "deadline_time must be empty when has_deadline is false."

        if self.is_recurring:
            if self.recurring_pattern is None:
                errors["recurring_pattern"] = "recurring_pattern is required when is_recurring is true."
            if self.recurring_pattern == Task.RecurringPattern.CUSTOM:
                invalid_days = [day for day in self.custom_days if not isinstance(day, int) or day < 0 or day > 6]
                if invalid_days:
                    errors["custom_days"] = "custom_days must contain only weekday integers from 0 to 6."
        else:
            if self.recurring_pattern is not None:
                errors["recurring_pattern"] = "recurring_pattern must be empty when is_recurring is false."
            if self.custom_days:
                errors["custom_days"] = "custom_days must be empty when is_recurring is false."

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.is_recurring:
            # Recurring tasks are templates; per-day status/timer are tracked in TaskOccurrence.
            self.status = Task.Status.PENDING
            self.completed_at = None
            self.timer_total_seconds = 0
            self.timer_running_since = None
            self.due_date = None
        else:
            self.due_date = self._build_due_date()

        if self.status == Task.Status.COMPLETED and self.completed_at is None:
            self.completed_at = timezone.now()
        if self.status != Task.Status.COMPLETED:
            self.completed_at = None
        self.full_clean()
        return super().save(*args, **kwargs)

    def is_overdue(self, now: datetime | None = None) -> bool:
        if self.is_recurring:
            return False
        if self.status == Task.Status.COMPLETED:
            return False
        now_utc = now or timezone.now()
        if self.due_date:
            return self.due_date < now_utc
        return self.scheduled_date < now_utc.date()

    def timer_elapsed_seconds(self, now: datetime | None = None) -> int:
        elapsed = self.timer_total_seconds
        if self.timer_running_since:
            now_utc = now or timezone.now()
            delta = max(0, int((now_utc - self.timer_running_since).total_seconds()))
            elapsed += delta
        return elapsed

    def timer_remaining_seconds(self, now: datetime | None = None) -> int:
        if not self.has_timer:
            return 0
        return max(0, self.timer_duration_seconds - self.timer_elapsed_seconds(now=now))


class TaskOccurrence(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="occurrences")
    date = models.DateField(db_index=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    timer_seconds = models.PositiveIntegerField(default=0)
    # Persist active timer state per occurrence for safe resume after refresh/reload.
    timer_running_since = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["date", "id"]
        constraints = [
            models.UniqueConstraint(fields=["task", "date"], name="unique_task_occurrence_per_date"),
        ]

    def __str__(self) -> str:
        return f"{self.task_id}:{self.date.isoformat()}"


class UserSettings(models.Model):
    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"
        SYSTEM = "system", "System"

    class AnimationIntensity(models.TextChoices):
        FULL = "full", "Full"
        REDUCED = "reduced", "Reduced"

    class DateFormat(models.TextChoices):
        MM_DD_YYYY = "MM/DD/YYYY", "MM/DD/YYYY"
        DD_MM_YYYY = "DD/MM/YYYY", "DD/MM/YYYY"
        YYYY_MM_DD = "YYYY-MM-DD", "YYYY-MM-DD"

    class TimeFormat(models.TextChoices):
        H12 = "12h", "12h"
        H24 = "24h", "24h"

    class ThemeProfile(models.TextChoices):
        FOCUS = "focus", "Focus"
        CALM = "calm", "Calm"
        ENERGY = "energy", "Energy"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="settings")
    theme = models.CharField(max_length=16, choices=Theme.choices, default=Theme.DARK)
    theme_profile = models.CharField(max_length=16, choices=ThemeProfile.choices, default=ThemeProfile.FOCUS)
    sidebar_collapsed = models.BooleanField(default=False)
    animation_intensity = models.CharField(max_length=16, choices=AnimationIntensity.choices, default=AnimationIntensity.FULL)
    date_format = models.CharField(max_length=16, choices=DateFormat.choices, default=DateFormat.MM_DD_YYYY)
    time_format = models.CharField(max_length=8, choices=TimeFormat.choices, default=TimeFormat.H12)
    language = models.CharField(max_length=12, blank=True, default="")
    min_daily_tasks = models.PositiveIntegerField(default=3, validators=[MinValueValidator(1)])
    streak_threshold_percent = models.PositiveIntegerField(
        default=80,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"settings:{self.user_id}"
