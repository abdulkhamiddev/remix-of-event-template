# Generated manually for occurrence-based recurring state

import calendar
from datetime import timedelta

from django.db import migrations, models
import django.db.models.deletion


def _iter_monthly_dates(start_date, end_date, day):
    results = []
    cursor = start_date.replace(day=1)
    while cursor <= end_date:
        last_day = calendar.monthrange(cursor.year, cursor.month)[1]
        if day <= last_day:
            candidate = cursor.replace(day=day)
            if start_date <= candidate <= end_date:
                results.append(candidate)
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1, day=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1, day=1)
    return results


def _iter_yearly_dates(start_date, end_date, month, day):
    results = []
    for year in range(start_date.year, end_date.year + 1):
        try:
            candidate = start_date.replace(year=year, month=month, day=day)
        except ValueError:
            continue
        if start_date <= candidate <= end_date:
            results.append(candidate)
    return results


def _occurrence_dates(task, start_date, end_date):
    if start_date > end_date:
        return []

    first_date = task.scheduled_date
    if first_date > end_date:
        return []

    effective_start = max(first_date, start_date)
    if not task.is_recurring or not task.recurring_pattern:
        return [first_date] if effective_start <= first_date <= end_date else []

    if task.recurring_pattern == "daily":
        days = (end_date - effective_start).days
        return [effective_start + timedelta(days=offset) for offset in range(days + 1)]

    if task.recurring_pattern == "monthly":
        return _iter_monthly_dates(effective_start, end_date, first_date.day)

    if task.recurring_pattern == "yearly":
        return _iter_yearly_dates(effective_start, end_date, first_date.month, first_date.day)

    # Frontend customDays: 0=Sunday..6=Saturday
    custom_days = set(task.custom_days or [])
    if not custom_days:
        return [first_date] if effective_start <= first_date <= end_date else []

    days = (end_date - effective_start).days
    matches = []
    for offset in range(days + 1):
        candidate = effective_start + timedelta(days=offset)
        frontend_weekday = (candidate.weekday() + 1) % 7
        if frontend_weekday in custom_days:
            matches.append(candidate)
    return matches


def _forward_create_occurrences(apps, schema_editor):
    Task = apps.get_model("tasks", "Task")
    TaskOccurrence = apps.get_model("tasks", "TaskOccurrence")

    from django.utils import timezone

    now = timezone.now()
    today = now.date()

    buffer = []
    buffer_size = 2000

    for task in Task.objects.all().iterator(chunk_size=500):
        start_date = task.scheduled_date
        end_date = today
        occurrence_dates = _occurrence_dates(task, start_date=start_date, end_date=end_date)

        if not occurrence_dates and not task.is_recurring:
            occurrence_dates = [task.scheduled_date]

        completion_date = None
        if task.status == "completed":
            if task.is_recurring and task.completed_at:
                completion_date = task.completed_at.date()
            else:
                completion_date = task.scheduled_date

        for occurrence_date in occurrence_dates:
            status = "pending"
            completed_at = None
            timer_seconds = 0
            timer_running_since = None

            if completion_date and occurrence_date == completion_date:
                status = "completed"
                completed_at = task.completed_at
                timer_seconds = int(task.timer_total_seconds or 0)
                timer_running_since = task.timer_running_since

            buffer.append(
                TaskOccurrence(
                    task_id=task.id,
                    date=occurrence_date,
                    status=status,
                    completed_at=completed_at,
                    timer_seconds=max(0, timer_seconds),
                    timer_running_since=timer_running_since,
                )
            )

            if len(buffer) >= buffer_size:
                TaskOccurrence.objects.bulk_create(buffer, ignore_conflicts=True)
                buffer.clear()

        if task.is_recurring and (task.status == "completed" or task.completed_at is not None):
            Task.objects.filter(id=task.id).update(
                status="pending",
                completed_at=None,
                timer_total_seconds=0,
                timer_running_since=None,
                due_date=None,
            )

    if buffer:
        TaskOccurrence.objects.bulk_create(buffer, ignore_conflicts=True)


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0002_remove_task_timer_duration_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="TaskOccurrence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(db_index=True)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("completed", "Completed")], db_index=True, default="pending", max_length=10)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("timer_seconds", models.PositiveIntegerField(default=0)),
                ("timer_running_since", models.DateTimeField(blank=True, null=True)),
                ("task", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="occurrences", to="tasks.task")),
            ],
            options={"ordering": ["date", "id"]},
        ),
        migrations.AddConstraint(
            model_name="taskoccurrence",
            constraint=models.UniqueConstraint(fields=("task", "date"), name="unique_task_occurrence_per_date"),
        ),
        migrations.RunPython(_forward_create_occurrences, migrations.RunPython.noop),
    ]

