import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.tasks.models import Category, Task, UserSettings


class Command(BaseCommand):
    help = "Seed demo user, categories, and tasks for local development."

    def add_arguments(self, parser):
        parser.add_argument("--email", default="demo@example.com")
        parser.add_argument("--username", default="demo")
        parser.add_argument("--password", default="DemoPass123!")
        parser.add_argument("--tasks", type=int, default=30)

    def handle(self, *args, **options):
        random.seed(42)
        user_model = get_user_model()
        email = options["email"].strip().lower()
        username = options["username"].strip()
        password = options["password"]
        total_tasks = max(1, int(options["tasks"]))

        user = user_model.objects.filter(email=email).first() if email else None
        if user is None:
            user = user_model.objects.filter(username=username).first()
        if user is None:
            user = user_model.objects.create_user(
                username=username,
                email=email or None,
                password=password,
                display_name="Demo User",
            )
            self.stdout.write(self.style.SUCCESS(f"Created demo user: {user.username}"))
        else:
            user.set_password(password)
            user.display_name = user.display_name or "Demo User"
            user.save(update_fields=["password", "display_name"])
            self.stdout.write(self.style.WARNING(f"Updated demo user password: {user.username}"))

        UserSettings.objects.get_or_create(user=user)

        category_names = ["Study", "Work", "Personal", "Health", "Learning"]
        categories = []
        for index, name in enumerate(category_names):
            category, _created = Category.objects.get_or_create(
                user=user,
                name=name,
                defaults={"is_default": index == 0},
            )
            if index == 0 and not category.is_default:
                category.is_default = True
                category.save(update_fields=["is_default"])
            categories.append(category)

        Task.objects.filter(owner=user).delete()

        now = timezone.now()
        priorities = [Task.Priority.LOW, Task.Priority.MEDIUM, Task.Priority.HIGH]
        recurring_patterns = [Task.RecurringPattern.DAILY, Task.RecurringPattern.MONTHLY, Task.RecurringPattern.YEARLY]
        week_start = (now - timedelta(days=now.weekday())).date()

        weekly_templates = [
            {
                "title": "Weekly Plan",
                "offset": 0,
                "category_index": 0,
                "status": Task.Status.COMPLETED,
                "has_deadline": True,
                "deadline_hour": 9,
                "timer_duration": 1800,
                "timer_total": 1500,
                "completed_offset_days": 0,
            },
            {
                "title": "Deep Work Session",
                "offset": 1,
                "category_index": 1,
                "status": Task.Status.COMPLETED,
                "has_deadline": True,
                "deadline_hour": 14,
                "timer_duration": 3600,
                "timer_total": 3200,
                "completed_offset_days": 1,
            },
            {
                "title": "Refactor Legacy Flow",
                "offset": 2,
                "category_index": 1,
                "status": Task.Status.PENDING,
                "has_deadline": True,
                "deadline_hour": 11,
                "timer_duration": 1800,
                "timer_total": 600,
                "completed_offset_days": None,
            },
            {
                "title": "Personal Errands",
                "offset": 3,
                "category_index": 2,
                "status": Task.Status.COMPLETED,
                "has_deadline": False,
                "deadline_hour": None,
                "timer_duration": 0,
                "timer_total": 0,
                "completed_offset_days": 3,
            },
            {
                "title": "Health Routine",
                "offset": 4,
                "category_index": 3,
                "status": Task.Status.PENDING,
                "has_deadline": True,
                "deadline_hour": 8,
                "timer_duration": 1200,
                "timer_total": 500,
                "completed_offset_days": None,
            },
            {
                "title": "Learning Sprint",
                "offset": 5,
                "category_index": 4,
                "status": Task.Status.COMPLETED,
                "has_deadline": True,
                "deadline_hour": 17,
                "timer_duration": 2400,
                "timer_total": 2000,
                "completed_offset_days": 5,
            },
            {
                "title": "Weekly Wrap-up",
                "offset": 6,
                "category_index": 0,
                "status": Task.Status.PENDING,
                "has_deadline": False,
                "deadline_hour": None,
                "timer_duration": 900,
                "timer_total": 300,
                "completed_offset_days": None,
            },
        ]

        created_count = 0
        preset_count = min(total_tasks, len(weekly_templates))
        for index in range(preset_count):
            template = weekly_templates[index]
            scheduled_date = week_start + timedelta(days=template["offset"])
            has_deadline = bool(template["has_deadline"])
            deadline_time = None
            if has_deadline and template["deadline_hour"] is not None:
                deadline_time = timezone.datetime(
                    year=scheduled_date.year,
                    month=scheduled_date.month,
                    day=scheduled_date.day,
                    hour=template["deadline_hour"],
                    minute=0,
                ).time()

            completed_at = None
            if template["status"] == Task.Status.COMPLETED and template["completed_offset_days"] is not None:
                completed_at = timezone.make_aware(
                    timezone.datetime.combine(
                        week_start + timedelta(days=int(template["completed_offset_days"])),
                        timezone.datetime.min.time(),
                    )
                ) + timedelta(hours=18)

            task = Task(
                owner=user,
                category=categories[int(template["category_index"]) % len(categories)],
                title=f"{template['title']}",
                description="Seeded weekly review task",
                priority=random.choice(priorities),
                status=template["status"],
                scheduled_date=scheduled_date,
                has_deadline=has_deadline,
                deadline_time=deadline_time,
                has_timer=template["timer_duration"] > 0,
                timer_duration_seconds=int(template["timer_duration"]),
                timer_total_seconds=int(template["timer_total"]),
                timer_running_since=None,
                is_recurring=False,
                recurring_pattern=None,
                custom_days=[],
                completed_at=completed_at,
            )
            task.save()
            created_count += 1

        for index in range(preset_count, total_tasks):
            scheduled_date = (now + timedelta(days=random.randint(-15, 20))).date()
            has_timer = random.choice([True, False])
            timer_duration = random.choice([0, 900, 1800, 3600]) if has_timer else 0
            timer_total = random.randint(0, timer_duration) if timer_duration > 0 else 0
            has_deadline = random.choice([True, False])
            deadline_time = timezone.datetime(
                year=now.year,
                month=now.month,
                day=now.day,
                hour=random.randint(8, 22),
                minute=random.choice([0, 15, 30, 45]),
            ).time() if has_deadline else None
            is_recurring = random.choice([True, False, False])
            recurring_pattern = None
            custom_days = []
            if is_recurring:
                recurring_pattern = random.choice(recurring_patterns + [Task.RecurringPattern.CUSTOM])
                if recurring_pattern == Task.RecurringPattern.CUSTOM:
                    custom_days = sorted(random.sample(list(range(7)), k=random.randint(1, 4)))

            status = random.choice([Task.Status.PENDING, Task.Status.PENDING, Task.Status.COMPLETED])
            completed_at = None
            if status == Task.Status.COMPLETED:
                completed_at = now - timedelta(days=random.randint(0, 10))

            task = Task(
                owner=user,
                category=random.choice(categories),
                title=f"Demo Task {index + 1}",
                description=f"Seeded task #{index + 1}",
                priority=random.choice(priorities),
                status=status,
                scheduled_date=scheduled_date,
                has_deadline=has_deadline,
                deadline_time=deadline_time,
                has_timer=has_timer,
                timer_duration_seconds=timer_duration,
                timer_total_seconds=timer_total,
                timer_running_since=None,
                is_recurring=is_recurring,
                recurring_pattern=recurring_pattern,
                custom_days=custom_days,
                completed_at=completed_at,
            )
            task.save()
            created_count += 1

        self.stdout.write(self.style.SUCCESS(f"Seed completed: {created_count} tasks for {user.username}."))
