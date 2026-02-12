import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta

from django.utils import timezone
from ninja import Query, Router

from apps.analytics.schemas import AnalyticsPayloadSchema
from apps.common.auth import JWTAuth
from apps.common.exceptions import APIError
from apps.tasks.models import Task, TaskOccurrence
from apps.tasks.occurrences import ensure_occurrences_for_tasks, is_occurrence_overdue, occurrence_elapsed_seconds

router = Router(tags=["analytics"], auth=JWTAuth())


def _pct(numerator: int, denominator: int) -> int:
    if denominator <= 0:
        return 0
    return int(round((numerator / denominator) * 100))


def _normalize_period_percents(periods: list[dict]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for period in periods:
        grouped[period.get("kind") or "__default__"].append(period)

    for group in grouped.values():
        max_completed = max((item["completed"] for item in group), default=0)
        for item in group:
            item["percent"] = 0 if max_completed == 0 else int(round((item["completed"] / max_completed) * 100))
    return periods


def _query_range_occurrences(user, start_date: date, end_date: date) -> list[TaskOccurrence]:
    tasks = list(Task.objects.filter(owner=user).select_related("category").order_by("id"))
    if not tasks:
        return []
    ensure_occurrences_for_tasks(tasks, range_start=start_date, range_end=end_date)
    return list(
        TaskOccurrence.objects.filter(task_id__in=[task.id for task in tasks], date__gte=start_date, date__lte=end_date)
        .select_related("task", "task__category")
        .order_by("date", "task_id")
    )


def _created_counts(user, start_dt: datetime, end_dt: datetime) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    created_tasks = Task.objects.filter(owner=user, created_at__gte=start_dt, created_at__lt=end_dt).only("created_at")
    for task in created_tasks:
        counts[task.created_at.date().isoformat()] += 1
    return counts


def _bucket_metrics(occurrences: list[TaskOccurrence], now: datetime) -> dict:
    total = len(occurrences)
    completed = sum(1 for occurrence in occurrences if occurrence.status == TaskOccurrence.Status.COMPLETED)
    overdue = sum(1 for occurrence in occurrences if is_occurrence_overdue(occurrence.task, occurrence, now=now))
    timer_seconds = sum(occurrence_elapsed_seconds(occurrence.task, occurrence, now=now) for occurrence in occurrences)
    timer_minutes = timer_seconds // 60
    return {
        "total": total,
        "completed": completed,
        "overdue": overdue,
        "productivity": _pct(completed, total),
        "timerMinutes": int(timer_minutes),
    }


def _category_stats(occurrences: list[TaskOccurrence]) -> list[dict]:
    total_occurrences = len(occurrences)
    buckets: dict[str, dict] = defaultdict(lambda: {"name": "", "total": 0, "completed": 0})

    for occurrence in occurrences:
        task = occurrence.task
        name = task.category.name if task.category_id else "Study"
        bucket = buckets[name]
        bucket["name"] = name
        bucket["total"] += 1
        if occurrence.status == TaskOccurrence.Status.COMPLETED:
            bucket["completed"] += 1

    result = []
    for bucket in buckets.values():
        result.append(
            {
                "name": bucket["name"],
                "total": bucket["total"],
                "completed": bucket["completed"],
                "percentage": _pct(bucket["total"], total_occurrences),
                "completionRate": _pct(bucket["completed"], bucket["total"]),
            }
        )
    result.sort(key=lambda item: (-item["total"], item["name"]))
    return result


def _build_stats(occurrences: list[TaskOccurrence], created_count: int, now: datetime) -> dict:
    metrics = _bucket_metrics(occurrences, now=now)
    return {
        "total": metrics["total"],
        "completed": metrics["completed"],
        "overdue": metrics["overdue"],
        "productivity": metrics["productivity"],
        "totalTasks": metrics["total"],
        "created": created_count,
        "completionRate": metrics["productivity"],
        "timerMinutes": metrics["timerMinutes"],
    }


def _weekly_payload(user, target_date: date) -> dict:
    now = timezone.now()
    start_date = target_date - timedelta(days=target_date.weekday())
    end_date = start_date + timedelta(days=6)

    occurrences = _query_range_occurrences(user, start_date=start_date, end_date=end_date)
    created_map = _created_counts(
        user,
        timezone.make_aware(datetime.combine(start_date, datetime.min.time())),
        timezone.make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time())),
    )
    occurrences_by_day: dict[date, list[TaskOccurrence]] = defaultdict(list)
    for occurrence in occurrences:
        occurrences_by_day[occurrence.date].append(occurrence)

    trend_data = []
    productive_periods = []
    for idx in range(7):
        current = start_date + timedelta(days=idx)
        bucket_occurrences = occurrences_by_day.get(current, [])
        metrics = _bucket_metrics(bucket_occurrences, now=now)
        label = current.strftime("%a")
        trend_data.append(
            {
                "label": label,
                "total": metrics["total"],
                "completed": metrics["completed"],
                "overdue": metrics["overdue"],
                "productivity": metrics["productivity"],
                "created": created_map.get(current.isoformat(), 0),
                "timerMinutes": metrics["timerMinutes"],
            }
        )
        productive_periods.append(
            {
                "label": label,
                "completed": metrics["completed"],
                "total": metrics["total"],
                "rate": metrics["productivity"],
                "kind": "weekday",
            }
        )

    _normalize_period_percents(productive_periods)
    return {
        "rangeLabel": f"Week of {start_date.strftime('%b %d, %Y')}",
        "stats": _build_stats(occurrences, created_count=sum(created_map.values()), now=now),
        "trendData": trend_data,
        "categoryStats": _category_stats(occurrences),
        "productivePeriods": productive_periods,
    }


def _monthly_payload(user, year: int, month: int) -> dict:
    now = timezone.now()
    day_count = calendar.monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, day_count)

    start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time()))
    created_map = _created_counts(user, start_dt=start_dt, end_dt=end_dt)

    occurrences = _query_range_occurrences(user, start_date=start_date, end_date=end_date)
    occurrences_by_day: dict[date, list[TaskOccurrence]] = defaultdict(list)
    for occurrence in occurrences:
        occurrences_by_day[occurrence.date].append(occurrence)

    trend_data = []
    day_periods = []

    for day in range(1, day_count + 1):
        current = date(year, month, day)
        bucket_occurrences = occurrences_by_day.get(current, [])
        metrics = _bucket_metrics(bucket_occurrences, now=now)
        label = str(day)
        trend_data.append(
            {
                "label": label,
                "total": metrics["total"],
                "completed": metrics["completed"],
                "overdue": metrics["overdue"],
                "productivity": metrics["productivity"],
                "created": created_map.get(current.isoformat(), 0),
                "timerMinutes": metrics["timerMinutes"],
            }
        )

        day_periods.append(
            {
                "label": label,
                "completed": metrics["completed"],
                "total": metrics["total"],
                "rate": metrics["productivity"],
                "kind": "dayOfMonth",
            }
        )
    productive_periods = _normalize_period_percents(day_periods)

    return {
        "rangeLabel": date(year, month, 1).strftime("%B %Y"),
        "stats": _build_stats(occurrences, created_count=sum(created_map.values()), now=now),
        "trendData": trend_data,
        "categoryStats": _category_stats(occurrences),
        "productivePeriods": productive_periods,
    }


def _yearly_payload(user, year: int) -> dict:
    now = timezone.now()
    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)
    start_dt = timezone.make_aware(datetime.combine(start_date, datetime.min.time()))
    end_dt = timezone.make_aware(datetime.combine(end_date + timedelta(days=1), datetime.min.time()))

    created_map = _created_counts(user, start_dt=start_dt, end_dt=end_dt)
    occurrences = _query_range_occurrences(user, start_date=start_date, end_date=end_date)
    occurrences_by_month: dict[int, list[TaskOccurrence]] = defaultdict(list)
    for occurrence in occurrences:
        occurrences_by_month[occurrence.date.month].append(occurrence)

    created_by_month: dict[int, int] = defaultdict(int)
    for date_key, count in created_map.items():
        month = date.fromisoformat(date_key).month
        created_by_month[month] += count

    trend_data = []
    productive_periods = []
    for month in range(1, 13):
        bucket_occurrences = occurrences_by_month.get(month, [])
        metrics = _bucket_metrics(bucket_occurrences, now=now)
        label = calendar.month_abbr[month]
        trend_data.append(
            {
                "label": label,
                "total": metrics["total"],
                "completed": metrics["completed"],
                "overdue": metrics["overdue"],
                "productivity": metrics["productivity"],
                "created": created_by_month.get(month, 0),
                "timerMinutes": metrics["timerMinutes"],
            }
        )
        productive_periods.append(
            {
                "label": label,
                "completed": metrics["completed"],
                "total": metrics["total"],
                "rate": metrics["productivity"],
                "kind": "month",
            }
        )

    _normalize_period_percents(productive_periods)
    return {
        "rangeLabel": str(year),
        "stats": _build_stats(occurrences, created_count=sum(created_map.values()), now=now),
        "trendData": trend_data,
        "categoryStats": _category_stats(occurrences),
        "productivePeriods": productive_periods,
    }


@router.get("/weekly", response=AnalyticsPayloadSchema)
def weekly_analytics(request, date_value: date = Query(..., alias="date")):
    return _weekly_payload(request.auth, target_date=date_value)


@router.get("/monthly", response=AnalyticsPayloadSchema)
def monthly_analytics(request, year: int = Query(...), month: int = Query(...)):
    if month < 1 or month > 12:
        raise APIError("Month must be between 1 and 12.", code="invalid_month", status=422, fields={"month": "out_of_range"})
    return _monthly_payload(request.auth, year=year, month=month)


@router.get("/yearly", response=AnalyticsPayloadSchema)
def yearly_analytics(request, year: int = Query(...)):
    if year < 1970 or year > 2200:
        raise APIError("Year is out of range.", code="invalid_year", status=422, fields={"year": "out_of_range"})
    return _yearly_payload(request.auth, year=year)
