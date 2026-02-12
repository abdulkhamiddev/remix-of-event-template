from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0004_usersettings_streak_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="usersettings",
            name="theme_profile",
            field=models.CharField(
                choices=[("focus", "Focus"), ("calm", "Calm"), ("energy", "Energy")],
                default="focus",
                max_length=16,
            ),
        ),
    ]
