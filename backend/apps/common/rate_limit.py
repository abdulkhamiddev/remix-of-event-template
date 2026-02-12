import hashlib
import math
import re
import time
from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable
from uuid import uuid4

from redis.exceptions import WatchError
from django_redis import get_redis_connection


class RateLimitExceeded(Exception):
    def __init__(self, retry_after: int) -> None:
        self.retry_after = max(1, int(retry_after))
        super().__init__("rate_limited")


@dataclass(frozen=True)
class RateLimitRule:
    name: str
    rate: str
    key_func: Callable[[Any, tuple[Any, ...], dict[str, Any]], str | None]


_RATE_RE = re.compile(r"^\s*(\d+)\s*/\s*([smhd])\s*$", re.IGNORECASE)
_UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600, "d": 86400}

def parse_rate(rate: str) -> tuple[int, int]:
    match = _RATE_RE.match(rate or "")
    if not match:
        raise ValueError(f"Invalid rate format: {rate!r}")
    limit = int(match.group(1))
    unit = match.group(2).lower()
    if limit <= 0:
        raise ValueError("Rate limit must be greater than zero.")
    return limit, _UNIT_SECONDS[unit]


def request_ip(request) -> str:
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return (request.META.get("REMOTE_ADDR") or "").strip() or "unknown"


def _rate_key(scope: str, rule_name: str, identifier: str) -> str:
    hashed = hashlib.sha256(identifier.encode("utf-8")).hexdigest()
    return f"ratelimit:{scope}:{rule_name}:{hashed}"


def enforce_rate_limit(scope: str, rule_name: str, identifier: str, rate: str) -> None:
    limit, window_seconds = parse_rate(rate)
    window_ms = window_seconds * 1000
    key = _rate_key(scope, rule_name, identifier)

    redis = get_redis_connection("default")
    for _ in range(5):
        now_ms = int(time.time() * 1000)
        member = f"{now_ms}:{uuid4().hex}"
        pipeline = redis.pipeline()
        try:
            pipeline.watch(key)
            pipeline.zremrangebyscore(key, 0, now_ms - window_ms)
            current = int(pipeline.zcard(key))
            oldest = pipeline.zrange(key, 0, 0, withscores=True)

            if current >= limit:
                retry_ms = window_ms
                if oldest:
                    oldest_score = int(oldest[0][1])
                    retry_ms = window_ms - (now_ms - oldest_score)
                raise RateLimitExceeded(retry_after=max(1, math.ceil(max(retry_ms, 0) / 1000)))

            pipeline.multi()
            pipeline.zadd(key, {member: now_ms})
            pipeline.pexpire(key, window_ms)
            pipeline.execute()
            return
        except WatchError:
            continue
        finally:
            pipeline.reset()

    raise RateLimitExceeded(retry_after=1)


def rate_limit_rules(
    scope: str,
    rules: list[RateLimitRule],
    *,
    methods: tuple[str, ...] = ("POST",),
) -> Callable:
    methods_set = {method.upper() for method in methods}

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            if args:
                request = args[0]
                remaining_args = args[1:]
                remaining_kwargs = kwargs
            else:
                request = kwargs.get("request")
                remaining_args = ()
                remaining_kwargs = {k: v for k, v in kwargs.items() if k != "request"}

            if request is None:
                return func(*args, **kwargs)

            request_method = getattr(request, "method", "").upper()
            if request_method not in methods_set:
                return func(*args, **kwargs)

            retry_after_values: list[int] = []
            for rule in rules:
                identifier = rule.key_func(request, remaining_args, remaining_kwargs)
                if not identifier:
                    continue
                try:
                    enforce_rate_limit(scope, rule.name, identifier, rule.rate)
                except RateLimitExceeded as exc:
                    retry_after_values.append(exc.retry_after)

            if retry_after_values:
                raise RateLimitExceeded(max(retry_after_values))
            return func(*args, **kwargs)

        return wrapper

    return decorator
