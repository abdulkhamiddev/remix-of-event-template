import asyncio
import os
from pathlib import Path

from aiogram import Bot, Dispatcher, F
from aiogram.filters import CommandObject, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message
from asgiref.sync import sync_to_async
from dotenv import load_dotenv
from django.contrib.auth import get_user_model
from django.db import transaction

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from apps.accounts.telegram_magic import (
    build_magic_link_url,
    create_magic_link,
    get_magic_link_ttl_minutes,
)
from apps.common.exceptions import APIError
from apps.common.rate_limit import RateLimitExceeded

User = get_user_model()


@transaction.atomic
def _issue_link_for_telegram(
    *,
    telegram_id: int,
    telegram_username: str | None,
    first_name: str | None,
) -> tuple[str, bool]:
    user_by_tg = User.objects.filter(telegram_id=telegram_id).first()
    is_existing_user = user_by_tg is not None
    token, _ = create_magic_link(
        user=user_by_tg,
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        telegram_first_name=first_name,
    )
    return build_magic_link_url(token), is_existing_user


async def _send_login_link(message: Message) -> None:
    if not message.from_user:
        return
    try:
        magic_url, is_existing_user = await sync_to_async(_issue_link_for_telegram)(
            telegram_id=message.from_user.id,
            telegram_username=message.from_user.username,
            first_name=message.from_user.first_name,
        )
    except APIError as exc:
        await message.answer(exc.detail)
        return
    except RateLimitExceeded as exc:
        await message.answer(f"Too many requests. Please try again in {exc.retry_after} seconds.")
        return
    except Exception:
        await message.answer("Could not generate login link right now. Please try again.")
        return

    greeting = "Welcome back." if is_existing_user else "Welcome to TaskFlow."
    await message.answer(
        f"{greeting} Your secure login link is ready. It expires in {get_magic_link_ttl_minutes()} minutes and can be used once.",
        reply_markup=InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="Login to TaskFlow", url=magic_url)]]
        ),
    )


async def handle_start(message: Message, command: CommandObject | None = None) -> None:
    payload = (command.args or "").strip() if command else ""
    if payload == "login":
        await _send_login_link(message)
        return

    await message.answer("TaskFlow sign-in bot.\n\nPress /start login to get a secure one-time login link.")


async def handle_text(message: Message) -> None:
    text = (message.text or "").strip().lower()
    if text in {"login", "start login"}:
        await _send_login_link(message)


async def main() -> None:
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    if not bot_token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is required for bot runner.")

    bot = Bot(bot_token)
    dp = Dispatcher()
    dp.message.register(handle_start, CommandStart())
    dp.message.register(handle_text, F.text)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
