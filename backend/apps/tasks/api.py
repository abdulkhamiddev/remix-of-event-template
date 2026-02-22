from datetime import UTC, date, datetime

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from ninja import Query, Router

from apps.common.auth import JWTAuth
from apps.common.exceptions import APIError
from apps.common.pagination import paginate_queryset
from apps.tasks.models import Category, Task, TaskOccurrence, UserSettings
from apps.tasks.occurrences import (
    ensure_occurrence_for_task_date,
    ensure_occurrences_for_tasks,
    is_occurrence_overdue,
    occurrence_due_datetime,
    occurrence_elapsed_seconds,
    occurrence_remaining_seconds,
    task_occurs_on_date,
)
from apps.tasks.schemas import (
    CategoryCreateIn,
    CategoryOut,
    CategoryPatchIn,
    SettingsOut,
    SettingsPatchIn,
    TaskCreateIn,
    TaskListOut,
    TaskOut,
    TaskPatchIn,
)

router = Router(tags=["tasks"], auth=JWTAuth())


def _ensure_default_category(user) -> Category:
    category, _created = Category.objects.get_or_create(
        user=user,
        is_default=True,
        defaults={"name": "Study"},
    )
    if category.name != "Study":
        category.name = "Study"
        category.save(update_fields=["name"])
    return category


def _serialize_category(category: Category) -> dict:
    return {
        "id": str(category.id),
        "name": category.name,
        "isDefault": category.is_default,
        "color": category.color or None,
        "icon": category.icon or None,
    }


def _serialize_settings(settings: UserSettings) -> dict:
    return {
        "theme": settings.theme,
        "themeProfile": settings.theme_profile,
        "sidebarCollapsed": settings.sidebar_collapsed,
        "animationIntensity": settings.animation_intensity,
        "dateFormat": settings.date_format,
        "timeFormat": settings.time_format,
        "language": settings.language or None,
        "minDailyTasks": int(settings.min_daily_tasks),
        "streakThresholdPercent": int(settings.streak_threshold_percent),
    }


def _get_or_create_settings(user) -> UserSettings:
    settings, _created = UserSettings.objects.get_or_create(user=user)
    return settings


def _serialize_task_occurrence(task: Task, occurrence: TaskOccurrence, now: datetime | None = None) -> dict:
    now_utc = now or timezone.now()
    category_name = task.category.name if task.category_id else "Study"
    deadline_time = task.deadline_time.strftime("%H:%M") if task.has_deadline and task.deadline_time else ""

    if occurrence.status == TaskOccurrence.Status.COMPLETED:
        api_status = "completed"
    elif is_occurrence_overdue(task, occurrence, now=now_utc):
        api_status = "overdue"
    else:
        api_status = "pending"

    return {
        "id": str(task.id),
        "occurrenceId": str(occurrence.id),
        "occurrenceKey": f"{task.id}:{occurrence.date.isoformat()}",
        "title": task.title,
        "description": task.description or "",
        "priority": task.priority,
        "scheduledDate": occurrence.date.isoformat(),
        "category": category_name,
        "hasTimer": task.has_timer,
        "timerDuration": task.timer_duration_seconds,
        "timerRemaining": occurrence_remaining_seconds(task, occurrence, now=now_utc),
        "timerStartedAt": occurrence.timer_running_since.astimezone(UTC).isoformat() if occurrence.timer_running_since else None,
        "hasDeadline": task.has_deadline,
        "deadlineTime": deadline_time,
        "isRecurring": task.is_recurring,
        "recurringPattern": task.recurring_pattern,
        "customDays": task.custom_days or [],
        "status": api_status,
        "createdAt": task.created_at.astimezone(UTC).isoformat(),
        "completedAt": occurrence.completed_at.astimezone(UTC).isoformat() if occurrence.completed_at else None,
    }


def _parse_deadline_time(deadline_time: str | None):
    if not deadline_time:
        return None
    try:
        return datetime.strptime(deadline_time, "%H:%M").time()
    except ValueError as exc:
        raise APIError(
            "Validation failed.",
            code="validation_error",
            status=422,
            fields={"deadlineTime": "Use HH:MM format."},
        ) from exc


def _resolve_category(user, category_id: int | None, category_name: str | None) -> Category | None:
    if category_id is not None:
        category = Category.objects.filter(user=user, id=category_id).first()
        if not category:
            raise APIError("Category not found.", code="not_found", status=404)
        return category
    if category_name is not None:
        normalized = category_name.strip()
        if not normalized:
            return _ensure_default_category(user)
        category, _created = Category.objects.get_or_create(
            user=user,
            name=normalized,
            defaults={"is_default": normalized.lower() == "study"},
        )
        return category
    return _ensure_default_category(user)


def _build_task_from_payload(task: Task, payload, fields_set: set[str], user):
    if "title" in fields_set:
        task.title = payload.title
    if "description" in fields_set:
        task.description = payload.description or ""
    if "priority" in fields_set:
        task.priority = payload.priority
    if "scheduledDate" in fields_set:
        task.scheduled_date = payload.scheduledDate
    if "categoryId" in fields_set or "category" in fields_set:
        task.category = _resolve_category(user, payload.categoryId, payload.category)
    if "hasTimer" in fields_set:
        task.has_timer = bool(payload.hasTimer)
        if not task.has_timer:
            task.timer_running_since = None
            task.timer_duration_seconds = 0
            task.timer_total_seconds = 0
    if "timerDuration" in fields_set:
        task.timer_duration_seconds = max(0, int(payload.timerDuration or 0))
    if "timerRemaining" in fields_set:
        remaining = max(0, int(payload.timerRemaining or 0))
        task.timer_total_seconds = max(0, task.timer_duration_seconds - remaining)
    if "timerStartedAt" in fields_set:
        task.timer_running_since = payload.timerStartedAt
    if "hasDeadline" in fields_set:
        task.has_deadline = bool(payload.hasDeadline)
        if not task.has_deadline:
            task.deadline_time = None
    if "deadlineTime" in fields_set:
        task.deadline_time = _parse_deadline_time(payload.deadlineTime)
    if "isRecurring" in fields_set:
        task.is_recurring = bool(payload.isRecurring)
        if not task.is_recurring:
            task.recurring_pattern = None
            task.custom_days = []
    if "recurringPattern" in fields_set:
        task.recurring_pattern = payload.recurringPattern
    if "customDays" in fields_set:
        task.custom_days = payload.customDays or []
    if "status" in fields_set and payload.status is not None:
        task.status = Task.Status.COMPLETED if payload.status == "completed" else Task.Status.PENDING
    if "completedAt" in fields_set:
        task.completed_at = payload.completedAt
    return task


def _get_owned_task(user, task_id: int) -> Task:
    task = Task.objects.filter(owner=user, id=task_id).select_related("category").first()
    if not task:
        raise APIError("Task not found.", code="not_found", status=404)
    return task


def _validate_range(start: date | None, end: date | None) -> tuple[date | None, date | None]:
    if (start is None) ^ (end is None):
        raise APIError(
            "Validation failed.",
            code="validation_error",
            status=422,
            fields={"start": "start and end must be provided together.", "end": "start and end must be provided together."},
        )
    if start is not None and end is not None and start > end:
        raise APIError("Validation failed.", code="validation_error", status=422, fields={"start": "start must be <= end."})
    if start is not None and end is not None:
        max_days = max(1, int(getattr(settings, "MAX_TASK_RANGE_DAYS", 31)))
        days = (end - start).days + 1
        if days > max_days:
            raise APIError(
                "range_too_large",
                code="range_too_large",
                status=422,
                fields={
                    "start": f"Range too large (max {max_days} days).",
                    "end": f"Range too large (max {max_days} days).",
                },
            )
    return start, end


def _status_matches(status_filter: str | None, payload_status: str) -> bool:
    if not status_filter:
        return True
    return payload_status == status_filter


def _validate_status_filter(status: str | None) -> None:
    if status and status not in {"pending", "completed", "overdue"}:
        raise APIError("Validation failed.", code="validation_error", status=422, fields={"status": "Invalid status."})


def _list_occurrence_items(
    tasks: list[Task],
    *,
    range_start: date,
    range_end: date,
    now: datetime,
    status: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
) -> list[dict]:
    if not tasks:
        return []

    ensure_occurrences_for_tasks(tasks, range_start=range_start, range_end=range_end)
    occurrences = list(
        TaskOccurrence.objects.filter(task_id__in=[task.id for task in tasks], date__gte=range_start, date__lte=range_end)
        .select_related("task", "task__category")
        .order_by("date", "task_id")
    )

    items: list[dict] = []
    for occurrence in occurrences:
        task = occurrence.task
        due_dt = occurrence_due_datetime(task, occurrence.date)
        if due_from is not None and (due_dt is None or due_dt.date() < due_from):
            continue
        if due_to is not None and (due_dt is None or due_dt.date() > due_to):
            continue

        payload = _serialize_task_occurrence(task, occurrence, now=now)
        if not _status_matches(status, payload["status"]):
            continue
        items.append(payload)

    items.sort(key=lambda item: (item["scheduledDate"], item["createdAt"], item["id"]))
    return items


def _resolve_target_date(task: Task, target_date: date | None) -> date:
    if task.is_recurring and target_date is None:
        raise APIError(
            "occurrence_date_required",
            code="occurrence_date_required",
            status=422,
        )
    resolved = target_date or task.scheduled_date
    if not task_occurs_on_date(task, resolved):
        raise APIError(
            "Validation failed.",
            code="validation_error",
            status=422,
            fields={"date": "Task does not occur on the provided date."},
        )
    return resolved


def _sync_non_recurring_template(task: Task, occurrence: TaskOccurrence) -> None:
    task.status = Task.Status.COMPLETED if occurrence.status == TaskOccurrence.Status.COMPLETED else Task.Status.PENDING
    task.completed_at = occurrence.completed_at
    task.timer_total_seconds = occurrence.timer_seconds
    task.timer_running_since = occurrence.timer_running_since
    task.save()


@router.get("/tasks", response=TaskListOut)
def list_tasks(
    request,
    page: int = Query(1),
    pageSize: int = Query(20),
    search: str | None = Query(None),
    status: str | None = Query(None),
    priority: str | None = Query(None),
    categoryId: int | None = Query(None),
    start: date | None = Query(None),
    end: date | None = Query(None),
    dueFrom: date | None = Query(None),
    dueTo: date | None = Query(None),
    ordering: str | None = Query(None),
):
    _validate_range(start, end)
    _validate_status_filter(status)
    now = timezone.now()

    queryset = Task.objects.filter(owner=request.auth).select_related("category")
    if search:
        queryset = queryset.filter(Q(title__icontains=search) | Q(description__icontains=search))
    if priority:
        queryset = queryset.filter(priority=priority)
    if categoryId is not None:
        queryset = queryset.filter(category_id=categoryId)

    if start is not None and end is not None:
        tasks = list(queryset.order_by("scheduled_date", "id"))
        items = _list_occurrence_items(
            tasks,
            range_start=start,
            range_end=end,
            now=now,
            status=status,
            due_from=dueFrom,
            due_to=dueTo,
        )
        total = len(items)
        return {
            "items": items,
            "pagination": {"page": 1, "pageSize": total, "total": total, "totalPages": 1 if total else 0},
        }

    ordering_map = {
        "createdAt": "created_at",
        "-createdAt": "-created_at",
        "scheduledDate": "scheduled_date",
        "-scheduledDate": "-scheduled_date",
        "dueDate": "due_date",
        "-dueDate": "-due_date",
        "priority": "priority",
        "-priority": "-priority",
        "updatedAt": "updated_at",
        "-updatedAt": "-updated_at",
    }
    db_ordering = ordering_map.get(ordering) if ordering else "scheduled_date"
    if ordering and db_ordering is None:
        raise APIError("Validation failed.", code="validation_error", status=422, fields={"ordering": "Unsupported ordering."})

    queryset = queryset.order_by(db_ordering, "id")
    paged, pagination = paginate_queryset(queryset, page=page, page_size=pageSize)
    tasks = list(paged)
    if not tasks:
        return {"items": [], "pagination": pagination}

    baseline_occurrences = {
        (occurrence.task_id, occurrence.date): occurrence
        for occurrence in TaskOccurrence.objects.filter(
            task_id__in=[task.id for task in tasks],
            date__in=[task.scheduled_date for task in tasks],
        )
    }

    items: list[dict] = []
    for task in tasks:
        occurrence = baseline_occurrences.get((task.id, task.scheduled_date))
        if occurrence is None:
            occurrence = ensure_occurrence_for_task_date(task, task.scheduled_date)
        due_dt = occurrence_due_datetime(task, occurrence.date)
        if dueFrom is not None and (due_dt is None or due_dt.date() < dueFrom):
            continue
        if dueTo is not None and (due_dt is None or due_dt.date() > dueTo):
            continue
        payload = _serialize_task_occurrence(task, occurrence, now=now)
        if _status_matches(status, payload["status"]):
            items.append(payload)

    pagination["total"] = len(items) if len(items) < pagination["total"] else pagination["total"]
    return {"items": items, "pagination": pagination}


@router.get("/tasks/today", response=TaskListOut)
def list_tasks_today(
    request,
    date_value: date | None = Query(None, alias="date"),
    status: str | None = Query(None),
):
    _validate_status_filter(status)
    now = timezone.now()
    target_date = date_value or now.astimezone(UTC).date()
    tasks = list(Task.objects.filter(owner=request.auth).select_related("category").order_by("scheduled_date", "id"))
    items = _list_occurrence_items(
        tasks,
        range_start=target_date,
        range_end=target_date,
        now=now,
        status=status,
    )
    total = len(items)
    return {
        "items": items,
        "pagination": {"page": 1, "pageSize": total, "total": total, "totalPages": 1 if total else 0},
    }


@router.post("/tasks", response=TaskOut)
def create_task(request, payload: TaskCreateIn):
    _ensure_default_category(request.auth)
    task = Task(owner=request.auth)
    task = _build_task_from_payload(task, payload, payload.model_fields_set, request.auth)
    if task.category is None:
        task.category = _ensure_default_category(request.auth)
    if task.has_timer and task.timer_duration_seconds > 0 and payload.timerRemaining is None:
        task.timer_total_seconds = 0
    task.save()

    occurrence = ensure_occurrence_for_task_date(task, task.scheduled_date)
    if not task.is_recurring and task.status == Task.Status.COMPLETED:
        occurrence.status = TaskOccurrence.Status.COMPLETED
        occurrence.completed_at = task.completed_at
        occurrence.timer_seconds = task.timer_total_seconds
        occurrence.timer_running_since = task.timer_running_since
        occurrence.save(update_fields=["status", "completed_at", "timer_seconds", "timer_running_since"])
    return _serialize_task_occurrence(task, occurrence)


@router.get("/tasks/occurrence", response=TaskOut)
def get_task_occurrence(
    request,
    task_id: int = Query(..., alias="task_id"),
    occurrence_date: date = Query(..., alias="date"),
):
    task = _get_owned_task(request.auth, task_id)
    target_date = _resolve_target_date(task, occurrence_date)
    occurrence = ensure_occurrence_for_task_date(task, target_date)
    return _serialize_task_occurrence(task, occurrence)


@router.get("/tasks/{task_id}", response=TaskOut)
def get_task(request, task_id: int):
    task = _get_owned_task(request.auth, task_id)
    occurrence = ensure_occurrence_for_task_date(task, task.scheduled_date)
    return _serialize_task_occurrence(task, occurrence)


@router.patch("/tasks/{task_id}", response=TaskOut)
def patch_task(request, task_id: int, payload: TaskPatchIn):
    task = _get_owned_task(request.auth, task_id)
    previous_scheduled_date = task.scheduled_date
    previous_is_recurring = task.is_recurring

    task = _build_task_from_payload(task, payload, payload.model_fields_set, request.auth)
    task.save()

    if task.is_recurring:
        # Regenerate future pending instances lazily based on the updated recurrence template.
        if previous_is_recurring and (
            "scheduledDate" in payload.model_fields_set
            or "recurringPattern" in payload.model_fields_set
            or "customDays" in payload.model_fields_set
            or "isRecurring" in payload.model_fields_set
            or "hasDeadline" in payload.model_fields_set
            or "deadlineTime" in payload.model_fields_set
        ):
            TaskOccurrence.objects.filter(
                task=task,
                status=TaskOccurrence.Status.PENDING,
                date__gte=min(previous_scheduled_date, task.scheduled_date),
            ).delete()
        occurrence = ensure_occurrence_for_task_date(task, task.scheduled_date)
        return _serialize_task_occurrence(task, occurrence)

    occurrence = ensure_occurrence_for_task_date(task, task.scheduled_date)
    occurrence.status = TaskOccurrence.Status.COMPLETED if task.status == Task.Status.COMPLETED else TaskOccurrence.Status.PENDING
    occurrence.completed_at = task.completed_at
    occurrence.timer_seconds = task.timer_total_seconds
    occurrence.timer_running_since = task.timer_running_since
    occurrence.save(update_fields=["status", "completed_at", "timer_seconds", "timer_running_since"])

    TaskOccurrence.objects.filter(task=task).exclude(date=task.scheduled_date).delete()
    return _serialize_task_occurrence(task, occurrence)


@router.delete("/tasks/{task_id}", response={204: None})
def delete_task(request, task_id: int):
    task = _get_owned_task(request.auth, task_id)
    task.delete()
    return 204, None


@router.post("/tasks/{task_id}/complete", response=TaskOut)
def complete_task(request, task_id: int, date_value: date | None = Query(None, alias="date")):
    task = _get_owned_task(request.auth, task_id)
    target_date = _resolve_target_date(task, date_value)
    occurrence = ensure_occurrence_for_task_date(task, target_date)

    if occurrence.timer_running_since:
        occurrence.timer_seconds = occurrence_elapsed_seconds(task, occurrence, now=timezone.now())
        occurrence.timer_running_since = None

    occurrence.status = TaskOccurrence.Status.COMPLETED
    occurrence.completed_at = timezone.now()
    occurrence.save(update_fields=["status", "completed_at", "timer_seconds", "timer_running_since"])

    if not task.is_recurring:
        _sync_non_recurring_template(task, occurrence)
    return _serialize_task_occurrence(task, occurrence)


@router.post("/tasks/{task_id}/start-timer", response=TaskOut)
def start_timer(request, task_id: int, date_value: date | None = Query(None, alias="date")):
    task = _get_owned_task(request.auth, task_id)
    target_date = _resolve_target_date(task, date_value)

    if not task.has_timer:
        task.has_timer = True
        task.save(update_fields=["has_timer"])

    occurrence = ensure_occurrence_for_task_date(task, target_date)
    if occurrence.status != TaskOccurrence.Status.COMPLETED and occurrence.timer_running_since is None:
        occurrence.timer_running_since = timezone.now()
        occurrence.save(update_fields=["timer_running_since"])

    if not task.is_recurring:
        task.timer_running_since = occurrence.timer_running_since
        task.timer_total_seconds = occurrence.timer_seconds
        task.save()
    return _serialize_task_occurrence(task, occurrence)


@router.post("/tasks/{task_id}/stop-timer", response=TaskOut)
def stop_timer(request, task_id: int, date_value: date | None = Query(None, alias="date")):
    task = _get_owned_task(request.auth, task_id)
    target_date = _resolve_target_date(task, date_value)
    occurrence = ensure_occurrence_for_task_date(task, target_date)

    if occurrence.timer_running_since:
        elapsed_seconds = occurrence_elapsed_seconds(task, occurrence, now=timezone.now())
        occurrence.timer_seconds = elapsed_seconds
        occurrence.timer_running_since = None
        occurrence.save(update_fields=["timer_seconds", "timer_running_since"])

    if not task.is_recurring:
        _sync_non_recurring_template(task, occurrence)
    return _serialize_task_occurrence(task, occurrence)


@router.get("/categories", response=list[CategoryOut])
def list_categories(request):
    _ensure_default_category(request.auth)
    categories = Category.objects.filter(user=request.auth).order_by("-is_default", "name")
    return [_serialize_category(category) for category in categories]


@router.post("/categories", response=CategoryOut)
def create_category(request, payload: CategoryCreateIn):
    name = payload.name.strip()
    if not name:
        raise APIError("Validation failed.", code="validation_error", status=422, fields={"name": "Category name is required."})
    if Category.objects.filter(user=request.auth, name__iexact=name).exists():
        raise APIError("Validation failed.", code="validation_error", status=422, fields={"name": "Category already exists."})
    category = Category.objects.create(
        user=request.auth,
        name=name,
        color=(payload.color or "").strip(),
        icon=(payload.icon or "").strip(),
        is_default=False,
    )
    return _serialize_category(category)


def _get_owned_category(user, category_id: int) -> Category:
    category = Category.objects.filter(user=user, id=category_id).first()
    if not category:
        raise APIError("Category not found.", code="not_found", status=404)
    return category


@router.patch("/categories/{category_id}", response=CategoryOut)
def patch_category(request, category_id: int, payload: CategoryPatchIn):
    category = _get_owned_category(request.auth, category_id)
    if "name" in payload.model_fields_set:
        name = (payload.name or "").strip()
        if not name:
            raise APIError("Validation failed.", code="validation_error", status=422, fields={"name": "Category name is required."})
        duplicate = Category.objects.filter(user=request.auth, name__iexact=name).exclude(id=category.id).exists()
        if duplicate:
            raise APIError("Validation failed.", code="validation_error", status=422, fields={"name": "Category already exists."})
        category.name = name
    if "color" in payload.model_fields_set:
        category.color = (payload.color or "").strip()
    if "icon" in payload.model_fields_set:
        category.icon = (payload.icon or "").strip()
    category.save()
    return _serialize_category(category)


@router.delete("/categories/{category_id}", response={204: None})
def delete_category(request, category_id: int):
    category = _get_owned_category(request.auth, category_id)
    if category.is_default:
        raise APIError("Default category cannot be deleted.", code="default_category_protected", status=400)
    fallback = _ensure_default_category(request.auth)
    Task.objects.filter(owner=request.auth, category=category).update(category=fallback)
    category.delete()
    return 204, None


@router.get("/settings", response=SettingsOut)
def get_settings(request):
    return _serialize_settings(_get_or_create_settings(request.auth))


@router.patch("/settings", response=SettingsOut)
def patch_settings(request, payload: SettingsPatchIn):
    settings_obj = _get_or_create_settings(request.auth)
    if "theme" in payload.model_fields_set:
        settings_obj.theme = payload.theme
    if "themeProfile" in payload.model_fields_set and payload.themeProfile is not None:
        settings_obj.theme_profile = payload.themeProfile
    if "sidebarCollapsed" in payload.model_fields_set:
        settings_obj.sidebar_collapsed = bool(payload.sidebarCollapsed)
    if "animationIntensity" in payload.model_fields_set:
        settings_obj.animation_intensity = payload.animationIntensity
    if "dateFormat" in payload.model_fields_set:
        settings_obj.date_format = payload.dateFormat
    if "timeFormat" in payload.model_fields_set:
        settings_obj.time_format = payload.timeFormat
    if "language" in payload.model_fields_set:
        settings_obj.language = (payload.language or "").strip()
    if "minDailyTasks" in payload.model_fields_set and payload.minDailyTasks is not None:
        settings_obj.min_daily_tasks = int(payload.minDailyTasks)
    if "streakThresholdPercent" in payload.model_fields_set and payload.streakThresholdPercent is not None:
        settings_obj.streak_threshold_percent = int(payload.streakThresholdPercent)
    settings_obj.save()
    return _serialize_settings(settings_obj)
