import calendar
from datetime import UTC, date, datetime, timedelta

from django.utils import timezone

from apps.tasks.models import Task, TaskOccurrence


def _iter_monthly_dates(start: date, end: date, day: int) -> list[date]:
    results: list[date] = []
    cursor = date(start.year, start.month, 1)
    while cursor <= end:
        last_day = calendar.monthrange(cursor.year, cursor.month)[1]
        if day <= last_day:
            candidate = date(cursor.year, cursor.month, day)
            if start <= candidate <= end:
                results.append(candidate)
        if cursor.month == 12:
            cursor = date(cursor.year + 1, 1, 1)
        else:
            cursor = date(cursor.year, cursor.month + 1, 1)
    return results


def _iter_yearly_dates(start: date, end: date, month: int, day: int) -> list[date]:
    results: list[date] = []
    for year in range(start.year, end.year + 1):
        try:
            candidate = date(year, month, day)
        except ValueError:
            continue
        if start <= candidate <= end:
            results.append(candidate)
    return results


def occurrence_dates_for_task(task: Task, range_start: date, range_end: date) -> list[date]:
    if range_start > range_end:
        return []

    first_date = task.scheduled_date
    if first_date > range_end:
        return []

    effective_start = max(first_date, range_start)
    if not task.is_recurring or not task.recurring_pattern:
        return [first_date] if effective_start <= first_date <= range_end else []

    if task.recurring_pattern == Task.RecurringPattern.DAILY:
        days = (range_end - effective_start).days
        return [effective_start + timedelta(days=offset) for offset in range(days + 1)]

    if task.recurring_pattern == Task.RecurringPattern.MONTHLY:
        return _iter_monthly_dates(effective_start, range_end, first_date.day)

    if task.recurring_pattern == Task.RecurringPattern.YEARLY:
        return _iter_yearly_dates(effective_start, range_end, first_date.month, first_date.day)

    custom_days = set(task.custom_days or [])
    if not custom_days:
        return [first_date] if effective_start <= first_date <= range_end else []

    days = (range_end - effective_start).days
    matches: list[date] = []
    for offset in range(days + 1):
        candidate = effective_start + timedelta(days=offset)
        # Frontend customDays uses 0=Sunday..6=Saturday
        frontend_weekday = (candidate.weekday() + 1) % 7
        if frontend_weekday in custom_days:
            matches.append(candidate)
    return matches


def task_occurs_on_date(task: Task, target_date: date) -> bool:
    return len(occurrence_dates_for_task(task, range_start=target_date, range_end=target_date)) > 0


def occurrence_due_datetime(task: Task, occurrence_date: date) -> datetime | None:
    if not task.has_deadline or not task.deadline_time:
        return None
    return datetime.combine(occurrence_date, task.deadline_time, tzinfo=UTC)


def is_occurrence_overdue(task: Task, occurrence: TaskOccurrence, now: datetime | None = None) -> bool:
    if occurrence.status == TaskOccurrence.Status.COMPLETED:
        return False
    now_utc = now or timezone.now()
    due_dt = occurrence_due_datetime(task, occurrence.date)
    if due_dt:
        return due_dt < now_utc
    return occurrence.date < now_utc.date()


def occurrence_elapsed_seconds(task: Task, occurrence: TaskOccurrence, now: datetime | None = None) -> int:
    elapsed = occurrence.timer_seconds
    if occurrence.timer_running_since:
        now_utc = now or timezone.now()
        elapsed += max(0, int((now_utc - occurrence.timer_running_since).total_seconds()))
    if task.timer_duration_seconds > 0:
        return min(elapsed, task.timer_duration_seconds)
    return elapsed


def occurrence_remaining_seconds(task: Task, occurrence: TaskOccurrence, now: datetime | None = None) -> int:
    if not task.has_timer:
        return 0
    return max(0, task.timer_duration_seconds - occurrence_elapsed_seconds(task, occurrence, now=now))


def ensure_occurrences_for_tasks(tasks: list[Task], range_start: date, range_end: date) -> None:
    if not tasks or range_start > range_end:
        return

    task_ids = [task.id for task in tasks]
    existing_pairs = set(
        TaskOccurrence.objects.filter(task_id__in=task_ids, date__gte=range_start, date__lte=range_end).values_list(
            "task_id", "date"
        )
    )

    to_create: list[TaskOccurrence] = []
    for task in tasks:
        for occurrence_date in occurrence_dates_for_task(task, range_start=range_start, range_end=range_end):
            key = (task.id, occurrence_date)
            if key in existing_pairs:
                continue

            status = TaskOccurrence.Status.PENDING
            completed_at = None
            timer_seconds = 0

            if not task.is_recurring and task.status == Task.Status.COMPLETED and occurrence_date == task.scheduled_date:
                status = TaskOccurrence.Status.COMPLETED
                completed_at = task.completed_at
                timer_seconds = task.timer_total_seconds
            elif (
                task.is_recurring
                and task.status == Task.Status.COMPLETED
                and task.completed_at is not None
                and occurrence_date == task.completed_at.date()
            ):
                # Legacy migration path where recurring completion lived on the template.
                status = TaskOccurrence.Status.COMPLETED
                completed_at = task.completed_at
                timer_seconds = task.timer_total_seconds

            to_create.append(
                TaskOccurrence(
                    task=task,
                    date=occurrence_date,
                    status=status,
                    completed_at=completed_at,
                    timer_seconds=max(0, int(timer_seconds)),
                )
            )
            existing_pairs.add(key)

    if to_create:
        TaskOccurrence.objects.bulk_create(to_create, ignore_conflicts=True)


def ensure_occurrence_for_task_date(task: Task, target_date: date) -> TaskOccurrence:
    ensure_occurrences_for_tasks([task], range_start=target_date, range_end=target_date)
    occurrence = TaskOccurrence.objects.filter(task=task, date=target_date).first()
    if occurrence:
        return occurrence
    return TaskOccurrence.objects.create(task=task, date=target_date, status=TaskOccurrence.Status.PENDING)

