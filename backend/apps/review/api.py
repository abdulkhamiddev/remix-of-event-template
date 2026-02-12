from collections import defaultdict
from datetime import UTC, date, datetime, time, timedelta

from django.utils import timezone
from ninja import Query, Router

from apps.common.auth import JWTAuth
from apps.review.schemas import WeeklyReviewPayloadSchema
from apps.tasks.models import Task, TaskOccurrence
from apps.tasks.occurrences import ensure_occurrences_for_tasks, is_occurrence_overdue, occurrence_elapsed_seconds

router = Router(tags=["review"], auth=JWTAuth())

WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _week_bounds(target_date: date) -> tuple[date, date, datetime, datetime]:
    start_date = target_date - timedelta(days=target_date.weekday())
    end_date = start_date + timedelta(days=6)
    start_dt = datetime.combine(start_date, time.min, tzinfo=UTC)
    end_dt_exclusive = datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=UTC)
    return start_date, end_date, start_dt, end_dt_exclusive


def _completion_rate(completed: int, created: int) -> int:
    return int(round((completed / max(created, 1)) * 100))


def _resolve_top_category(completed_occurrences: list[TaskOccurrence], all_occurrences: list[TaskOccurrence]) -> str | None:
    completed_counts: dict[str, int] = defaultdict(int)
    total_counts: dict[str, int] = defaultdict(int)

    for occurrence in completed_occurrences:
        task = occurrence.task
        category_name = task.category.name if task.category_id else "Study"
        completed_counts[category_name] += 1

    for occurrence in all_occurrences:
        task = occurrence.task
        category_name = task.category.name if task.category_id else "Study"
        total_counts[category_name] += 1

    if completed_counts:
        return sorted(completed_counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
    if total_counts:
        return sorted(total_counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
    return None


def _resolve_most_productive_day(completed_occurrences: list[TaskOccurrence]) -> str | None:
    weekday_counts: dict[int, int] = defaultdict(int)
    for occurrence in completed_occurrences:
        completed_at = occurrence.completed_at
        if not completed_at:
            continue
        weekday_counts[completed_at.astimezone(UTC).weekday()] += 1

    if not weekday_counts:
        return None

    best_weekday = sorted(weekday_counts.items(), key=lambda item: (-item[1], item[0]))[0][0]
    return WEEKDAY_NAMES[best_weekday]


def _build_insights(
    created: int,
    completed: int,
    overdue: int,
    completion_rate: int,
    timer_minutes: int,
    most_productive_day: str | None,
) -> list[dict]:
    no_activity = created == 0 and completed == 0 and overdue == 0
    if no_activity:
        return [{"type": "hint", "text": "No data yet for this week. Add a few tasks to start building your review."}]

    insights: list[dict] = []

    if completion_rate < 40:
        insights.append({"type": "warning", "text": "Completion is below 40%. Consider reducing task load for each day."})
    if overdue > 0 and overdue >= completed:
        insights.append(
            {"type": "warning", "text": "Overdue tasks are outweighing completions. Re-prioritize deadlines this week."}
        )
    if most_productive_day:
        insights.append({"type": "strength", "text": f"{most_productive_day} was your strongest completion day."})
    if timer_minutes < 30:
        insights.append({"type": "hint", "text": "Tracked focus time is low. Try batching tasks into longer sessions."})
    return insights


def _next_week_focus(created: int, completed: int, overdue: int, completion_rate: int) -> str:
    no_activity = created == 0 and completed == 0 and overdue == 0
    if no_activity:
        return "Plan deep work on your most productive day and keep consistency."
    if completion_rate < 40:
        return "Reduce daily task load and focus on fewer priorities."
    if overdue >= completed:
        return "Adjust deadlines and break tasks into smaller steps."
    return "Plan deep work on your most productive day and keep consistency."


@router.get("/weekly", response=WeeklyReviewPayloadSchema)
def weekly_review(request, date_value: date = Query(..., alias="date")):
    start_date, end_date, start_dt, end_dt_exclusive = _week_bounds(date_value)
    user = request.auth

    tasks = list(Task.objects.filter(owner=user).select_related("category").order_by("id"))
    if tasks:
        ensure_occurrences_for_tasks(tasks, range_start=start_date, range_end=end_date)

    all_occurrences = list(
        TaskOccurrence.objects.filter(task__owner=user, date__gte=start_date, date__lte=end_date)
        .select_related("task", "task__category")
        .order_by("date", "task_id")
    )
    completed_occurrences = [occurrence for occurrence in all_occurrences if occurrence.status == TaskOccurrence.Status.COMPLETED]

    created = Task.objects.filter(owner=user, created_at__gte=start_dt, created_at__lt=end_dt_exclusive).count()
    completed = len(completed_occurrences)
    range_end_now = end_dt_exclusive - timedelta(microseconds=1)
    overdue = sum(
        1
        for occurrence in all_occurrences
        if occurrence.status != TaskOccurrence.Status.COMPLETED
        and is_occurrence_overdue(occurrence.task, occurrence, now=range_end_now)
    )

    now_utc = timezone.now()
    timer_seconds_total = sum(occurrence_elapsed_seconds(occurrence.task, occurrence, now=now_utc) for occurrence in all_occurrences)
    timer_minutes = int(timer_seconds_total // 60)

    completion_rate = _completion_rate(completed=completed, created=created)
    top_category = _resolve_top_category(completed_occurrences=completed_occurrences, all_occurrences=all_occurrences)
    most_productive_day = _resolve_most_productive_day(completed_occurrences=completed_occurrences)

    return {
        "rangeLabel": f"{start_date.isoformat()} - {end_date.isoformat()}",
        "metrics": {
            "created": created,
            "completed": completed,
            "completionRate": completion_rate,
            "overdue": overdue,
            "timerMinutes": timer_minutes,
            "topCategory": top_category,
            "mostProductiveDay": most_productive_day,
        },
        "insights": _build_insights(
            created=created,
            completed=completed,
            overdue=overdue,
            completion_rate=completion_rate,
            timer_minutes=timer_minutes,
            most_productive_day=most_productive_day,
        ),
        "nextWeekFocus": _next_week_focus(
            created=created,
            completed=completed,
            overdue=overdue,
            completion_rate=completion_rate,
        ),
    }
