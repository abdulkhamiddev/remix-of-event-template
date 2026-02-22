from datetime import date, timedelta

from django.conf import settings
from django.db.models import Count, Min, Q
from django.utils import timezone
from ninja import Query, Router

from apps.common.auth import JWTAuth
from apps.common.exceptions import APIError
from apps.streak.schemas import StreakSummarySchema, StreakTodaySchema
from apps.tasks.models import Task, TaskOccurrence, UserSettings
from apps.tasks.occurrences import ensure_occurrences_for_tasks

router = Router(tags=["streak"], auth=JWTAuth())


def _load_settings(user) -> tuple[int, int]:
    settings, _created = UserSettings.objects.get_or_create(user=user)
    min_daily_tasks = max(1, int(settings.min_daily_tasks or 3))
    threshold_percent = int(settings.streak_threshold_percent or 80)
    threshold_percent = max(1, min(100, threshold_percent))
    return min_daily_tasks, threshold_percent


def _ensure_occurrences(user, start_date: date, end_date: date) -> None:
    tasks = list(Task.objects.filter(owner=user).select_related("category").order_by("id"))
    if not tasks:
        return
    ensure_occurrences_for_tasks(tasks, range_start=start_date, range_end=end_date)


def _daily_counts(user, start_date: date, end_date: date) -> dict[date, tuple[int, int]]:
    rows = (
        TaskOccurrence.objects.filter(task__owner=user, date__gte=start_date, date__lte=end_date)
        .values("date")
        .annotate(
            scheduled=Count("id"),
            completed=Count("id", filter=Q(status=TaskOccurrence.Status.COMPLETED)),
        )
        .order_by("date")
    )
    return {row["date"]: (int(row["scheduled"]), int(row["completed"])) for row in rows}


def _day_payload(day: date, scheduled: int, completed: int, min_daily_tasks: int, threshold_percent: int) -> dict:
    ratio = 0.0 if scheduled <= 0 else round((completed / scheduled) * 100, 2)
    qualified = scheduled >= min_daily_tasks and ratio >= threshold_percent
    return {
        "date": day.isoformat(),
        "scheduled": scheduled,
        "completed": completed,
        "ratio": ratio,
        "qualified": qualified,
    }


def _best_streak(days: list[dict]) -> int:
    best = 0
    current = 0
    for day in days:
        if day["qualified"]:
            current += 1
            best = max(best, current)
        else:
            current = 0
    return best


def _current_streak(user, min_daily_tasks: int, threshold_percent: int, today_utc: date) -> int:
    earliest_task_date = Task.objects.filter(owner=user).aggregate(value=Min("scheduled_date"))["value"]
    if earliest_task_date is None:
        return 0

    # Avoid materializing an unbounded date range in a single request.
    max_days = max(1, int(getattr(settings, "MAX_TASK_RANGE_DAYS", 31)))
    tasks = list(Task.objects.filter(owner=user).select_related("category").order_by("id"))
    if not tasks:
        return 0

    streak = 0
    cursor = today_utc
    while cursor >= earliest_task_date:
        window_end = cursor
        window_start = max(earliest_task_date, cursor - timedelta(days=max_days - 1))
        ensure_occurrences_for_tasks(tasks, range_start=window_start, range_end=window_end)
        counts_map = _daily_counts(user, start_date=window_start, end_date=window_end)

        while cursor >= window_start:
            scheduled, completed = counts_map.get(cursor, (0, 0))
            ratio = 0.0 if scheduled <= 0 else (completed / scheduled) * 100
            qualified = scheduled >= min_daily_tasks and ratio >= threshold_percent
            if not qualified:
                return streak
            streak += 1
            cursor = cursor - timedelta(days=1)
    return streak


@router.get("/summary", response=StreakSummarySchema)
def streak_summary(
    request,
    start: date = Query(...),
    end: date = Query(...),
):
    if start > end:
        raise APIError("Validation failed.", code="validation_error", status=422, fields={"start": "start must be <= end."})
    max_days = max(1, int(getattr(settings, "MAX_TASK_RANGE_DAYS", 31)))
    days = (end - start).days + 1
    if days > max_days:
        raise APIError(
            "range_too_large",
            code="range_too_large",
            status=422,
            fields={"start": f"Range too large (max {max_days} days).", "end": f"Range too large (max {max_days} days)."},
        )

    user = request.auth
    min_daily_tasks, threshold_percent = _load_settings(user)
    _ensure_occurrences(user, start_date=start, end_date=end)
    counts_map = _daily_counts(user, start_date=start, end_date=end)

    days: list[dict] = []
    cursor = start
    while cursor <= end:
        scheduled, completed = counts_map.get(cursor, (0, 0))
        days.append(_day_payload(cursor, scheduled, completed, min_daily_tasks, threshold_percent))
        cursor = cursor + timedelta(days=1)

    today_utc = timezone.now().date()
    today_scheduled, today_completed = counts_map.get(today_utc, (0, 0))
    if start <= today_utc <= end:
        today_payload = next(day for day in days if day["date"] == today_utc.isoformat())
        today_qualified = bool(today_payload["qualified"])
    else:
        _ensure_occurrences(user, start_date=today_utc, end_date=today_utc)
        today_scheduled, today_completed = _daily_counts(user, today_utc, today_utc).get(today_utc, (0, 0))
        today_payload = _day_payload(today_utc, today_scheduled, today_completed, min_daily_tasks, threshold_percent)
        today_qualified = bool(today_payload["qualified"])

    return {
        "currentStreak": _current_streak(user, min_daily_tasks, threshold_percent, today_utc=today_utc),
        "bestStreak": _best_streak(days),
        "todayQualified": today_qualified,
        "rules": {
            "minDailyTasks": min_daily_tasks,
            "thresholdPercent": threshold_percent,
        },
        "days": days,
    }


@router.get("/today", response=StreakTodaySchema)
def streak_today(request):
    user = request.auth
    min_daily_tasks, threshold_percent = _load_settings(user)
    today_utc = timezone.now().date()

    _ensure_occurrences(user, start_date=today_utc, end_date=today_utc)
    scheduled, completed = _daily_counts(user, today_utc, today_utc).get(today_utc, (0, 0))
    payload = _day_payload(today_utc, scheduled, completed, min_daily_tasks, threshold_percent)

    return {
        "scheduled": payload["scheduled"],
        "completed": payload["completed"],
        "ratio": payload["ratio"],
        "qualified": payload["qualified"],
        "currentStreak": _current_streak(user, min_daily_tasks, threshold_percent, today_utc=today_utc),
    }
