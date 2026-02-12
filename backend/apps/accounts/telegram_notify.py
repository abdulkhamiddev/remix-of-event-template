import json
from urllib import parse, request

from django.conf import settings


def send_login_success_message(telegram_id: int) -> None:
    token = settings.TELEGRAM_BOT_TOKEN
    if not token:
        return

    payload = {
        "chat_id": telegram_id,
        "text": "Logged in successfully. You can return to TaskFlow.",
    }
    data = parse.urlencode(payload).encode("utf-8")
    req = request.Request(
        url=f"https://api.telegram.org/bot{token}/sendMessage",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=4) as response:
            # Read body to ensure socket cleanup.
            response.read()
    except Exception:
        # Best-effort notification only.
        return
