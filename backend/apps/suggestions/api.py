from collections import defaultdict
from datetime import date, timedelta

from django.utils import timezone
from ninja import Router

from apps.common.auth import JWTAuth
from apps.suggestions.schemas import TodaySuggestionsSchema
from apps.tasks.models import Task, TaskOccurrence, UserSettings
from apps.tasks.occurrences import ensure_occurrences_for_tasks, is_occurrence_overdue, occurrence_elapsed_seconds

router = Router(tags=["suggestions"], auth=JWTAuth())


def _pct(completed: int, total: int) -> int:
    if total <= 0:
        return 0
    return int(round((completed / total) * 100))


def _load_settings(user) -> tuple[int, int]:
    settings_obj, _created = UserSettings.objects.get_or_create(user=user)
    min_daily_tasks = max(1, int(settings_obj.min_daily_tasks or 3))
    threshold = int(settings_obj.streak_threshold_percent or 80)
    threshold = max(1, min(100, threshold))
    return min_daily_tasks, threshold


def _query_occurrences(user, start_date: date, end_date: date) -> list[TaskOccurrence]:
    tasks = list(Task.objects.filter(owner=user).select_related("category").order_by("id"))
    if not tasks:
        return []
    ensure_occurrences_for_tasks(tasks, range_start=start_date, range_end=end_date)
    return list(
        TaskOccurrence.objects.filter(task__owner=user, date__gte=start_date, date__lte=end_date)
        .select_related("task", "task__category")
        .order_by("date", "task_id")
    )


def _resolve_top_category(occurrences: list[TaskOccurrence]) -> str | None:
    buckets: dict[str, int] = defaultdict(int)
    for occurrence in occurrences:
        if occurrence.status != TaskOccurrence.Status.COMPLETED:
            continue
        name = occurrence.task.category.name if occurrence.task.category_id else "Study"
        buckets[name] += 1
    if not buckets:
        return None
    return sorted(buckets.items(), key=lambda item: (-item[1], item[0]))[0][0]


def _resolve_most_productive_day(occurrences: list[TaskOccurrence]) -> str | None:
    weekday_counts: dict[int, int] = defaultdict(int)
    for occurrence in occurrences:
        if occurrence.status != TaskOccurrence.Status.COMPLETED:
            continue
        completed_at = occurrence.completed_at
        weekday = completed_at.weekday() if completed_at else occurrence.date.weekday()
        weekday_counts[weekday] += 1

    if not weekday_counts:
        return None
    best_weekday = sorted(weekday_counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
    return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][best_weekday]


@router.get("/today", response=TodaySuggestionsSchema)
def today_suggestions(request):
    user = request.auth
    min_daily_tasks, _threshold = _load_settings(user)

    now_utc = timezone.now()
    today = now_utc.date()
    last_7_start = today - timedelta(days=6)

    occurrences = _query_occurrences(user, start_date=last_7_start, end_date=today)
    by_date: dict[date, list[TaskOccurrence]] = defaultdict(list)
    for occurrence in occurrences:
        by_date[occurrence.date].append(occurrence)

    today_occurrences = by_date.get(today, [])
    today_scheduled = len(today_occurrences)
    today_completed = sum(1 for occurrence in today_occurrences if occurrence.status == TaskOccurrence.Status.COMPLETED)
    today_ratio = _pct(today_completed, today_scheduled)

    last_7_scheduled = len(occurrences)
    last_7_completed = sum(1 for occurrence in occurrences if occurrence.status == TaskOccurrence.Status.COMPLETED)
    last_7_completion_rate = _pct(last_7_completed, last_7_scheduled)
    last_7_overdue = sum(1 for occurrence in occurrences if is_occurrence_overdue(occurrence.task, occurrence, now=now_utc))
    last_7_timer_minutes = int(sum(occurrence_elapsed_seconds(occurrence.task, occurrence, now=now_utc) for occurrence in occurrences) // 60)
    top_category = _resolve_top_category(occurrences)
    most_productive_day = _resolve_most_productive_day(occurrences)

    scored: list[dict] = []

    if today_scheduled == 0:
        scored.append(
            {
                "id": "plan-qualifying-tasks",
                "type": "hint",
                "title": "Plan Today",
                "text": "Plan 3 tasks to qualify streak.",
                "score": 95,
            }
        )
    elif today_scheduled < min_daily_tasks:
        scored.append(
            {
                "id": "below-min-daily",
                "type": "hint",
                "title": "Streak Threshold",
                "text": f"Schedule at least {min_daily_tasks} tasks to qualify.",
                "score": 88,
            }
        )

    if today_scheduled > 0 and today_ratio < 80:
        scored.append(
            {
                "id": "cross-80-focus",
                "type": "focus",
                "title": "Hit 80% Today",
                "text": "Finish 1–2 key tasks to cross 80% today.",
                "score": 86,
            }
        )

    if last_7_overdue > 0:
        scored.append(
            {
                "id": "clear-overdue-first",
                "type": "warning",
                "title": "Overdue Tasks",
                "text": "Clear overdue tasks first.",
                "score": 94,
            }
        )

    if most_productive_day and most_productive_day == today.strftime("%A"):
        scored.append(
            {
                "id": "strongest-day",
                "type": "praise",
                "title": "Peak Day",
                "text": "Today is your strongest day—do deep work.",
                "score": 74,
            }
        )

    if last_7_timer_minutes < 60:
        scored.append(
            {
                "id": "add-focus-block",
                "type": "hint",
                "title": "Focus Time",
                "text": "Try a 20-minute focus block.",
                "score": 60,
            }
        )

    if last_7_completion_rate < 40:
        scored.append(
            {
                "id": "reduce-task-load",
                "type": "warning",
                "title": "Weekly Trend",
                "text": "Reduce task load; plan fewer tasks.",
                "score": 89,
            }
        )

    if top_category and not any(item["type"] == "focus" for item in scored):
        scored.append(
            {
                "id": "focus-top-category",
                "type": "focus",
                "title": "Category Momentum",
                "text": f"Start with {top_category} tasks to keep momentum.",
                "score": 55,
            }
        )

    if not scored:
        scored.append(
            {
                "id": "keep-consistency",
                "type": "praise",
                "title": "Steady Week",
                "text": "Consistency looks strong. Keep your current rhythm today.",
                "score": 50,
            }
        )

    scored.sort(key=lambda item: (-int(item["score"]), item["id"]))
    top_items = scored[:3]

    return {
        "date": today.isoformat(),
        "suggestions": [{"id": item["id"], "type": item["type"], "title": item["title"], "text": item["text"]} for item in top_items],
    }
