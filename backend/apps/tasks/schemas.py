from datetime import date, datetime
from typing import Literal

from ninja import Schema
from pydantic import Field, model_validator

from apps.common.schemas import PaginationMeta

Priority = Literal["low", "medium", "high"]
TaskStatus = Literal["pending", "completed", "overdue"]
RecurringPattern = Literal["daily", "monthly", "yearly", "custom"]


class CategoryCreateIn(Schema):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = None
    icon: str | None = None


class CategoryPatchIn(Schema):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = None
    icon: str | None = None


class CategoryOut(Schema):
    id: str
    name: str
    isDefault: bool
    color: str | None = None
    icon: str | None = None


class SettingsPatchIn(Schema):
    theme: Literal["light", "dark", "system"] | None = None
    themeProfile: Literal["focus", "calm", "energy"] | None = None
    sidebarCollapsed: bool | None = None
    animationIntensity: Literal["full", "reduced"] | None = None
    dateFormat: Literal["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] | None = None
    timeFormat: Literal["12h", "24h"] | None = None
    language: str | None = None
    minDailyTasks: int | None = Field(default=None, ge=1)
    streakThresholdPercent: int | None = Field(default=None, ge=1, le=100)


class SettingsOut(Schema):
    theme: Literal["light", "dark", "system"]
    themeProfile: Literal["focus", "calm", "energy"]
    sidebarCollapsed: bool
    animationIntensity: Literal["full", "reduced"]
    dateFormat: Literal["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]
    timeFormat: Literal["12h", "24h"]
    language: str | None = None
    minDailyTasks: int
    streakThresholdPercent: int


class TaskBaseIn(Schema):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = ""
    priority: Priority | None = "medium"
    scheduledDate: date | None = None
    category: str | None = None
    categoryId: int | None = None
    hasTimer: bool | None = False
    timerDuration: int | None = 0
    timerRemaining: int | None = None
    timerStartedAt: datetime | None = None
    hasDeadline: bool | None = False
    deadlineTime: str | None = None
    isRecurring: bool | None = False
    recurringPattern: RecurringPattern | None = None
    customDays: list[int] | None = None
    status: TaskStatus | None = None
    completedAt: datetime | None = None

    @model_validator(mode="after")
    def validate_state(self):
        if self.status == "overdue":
            raise ValueError("status cannot be set to overdue directly; overdue is derived.")
        if self.hasDeadline and not self.deadlineTime:
            raise ValueError("deadlineTime is required when hasDeadline=true.")
        if (self.hasDeadline is False) and self.deadlineTime:
            raise ValueError("deadlineTime must be empty when hasDeadline=false.")
        if self.isRecurring and self.recurringPattern is None:
            raise ValueError("recurringPattern is required when isRecurring=true.")
        if (self.isRecurring is False) and self.recurringPattern is not None:
            raise ValueError("recurringPattern must be empty when isRecurring=false.")
        if self.isRecurring and self.recurringPattern == "custom":
            custom_days = self.customDays or []
            if len(custom_days) == 0:
                raise ValueError("customDays is required when recurringPattern=custom.")
            invalid_days = [day for day in custom_days if day < 0 or day > 6]
            if invalid_days:
                raise ValueError("customDays must use weekday indexes 0..6.")
        if (self.isRecurring is False) and self.customDays:
            raise ValueError("customDays must be empty when isRecurring=false.")
        return self


class TaskCreateIn(TaskBaseIn):
    title: str = Field(min_length=1, max_length=255)
    scheduledDate: date


class TaskPatchIn(TaskBaseIn):
    pass


class TaskOut(Schema):
    id: str
    title: str
    description: str
    priority: Priority
    scheduledDate: str
    category: str
    hasTimer: bool
    timerDuration: int
    timerRemaining: int
    timerStartedAt: str | None = None
    hasDeadline: bool
    deadlineTime: str
    isRecurring: bool
    recurringPattern: RecurringPattern | None = None
    customDays: list[int]
    status: TaskStatus
    createdAt: str
    completedAt: str | None = None


class TaskListOut(Schema):
    items: list[TaskOut]
    pagination: PaginationMeta
