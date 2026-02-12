# Generated manually for streak settings fields

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0003_taskoccurrence"),
    ]

    operations = [
        migrations.AddField(
            model_name="usersettings",
            name="min_daily_tasks",
            field=models.PositiveIntegerField(default=3, validators=[django.core.validators.MinValueValidator(1)]),
        ),
        migrations.AddField(
            model_name="usersettings",
            name="streak_threshold_percent",
            field=models.PositiveIntegerField(
                default=80,
                validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(100)],
            ),
        ),
    ]

