"""Лимит неудачных попыток входа: 10 / 15 мин / IP (как docs/security-decisions.md)."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone
from threading import Lock

_lock = Lock()
_failures: dict[str, list[datetime]] = defaultdict(list)

_WINDOW = timedelta(minutes=15)
_MAX_FAILURES = 10


def assert_login_allowed(client_ip: str | None) -> None:
    if not client_ip:
        return
    now = datetime.now(timezone.utc)
    with _lock:
        lst = _failures[client_ip]
        lst[:] = [t for t in lst if now - t < _WINDOW]
        if len(lst) >= _MAX_FAILURES:
            from fastapi import HTTPException

            raise HTTPException(
                status_code=429,
                detail={
                    "statusCode": 429,
                    "message": "Слишком много попыток входа, попробуйте позже",
                    "error": "Too Many Requests",
                },
            )


def register_login_failure(client_ip: str | None) -> None:
    if not client_ip:
        return
    now = datetime.now(timezone.utc)
    with _lock:
        lst = _failures[client_ip]
        lst[:] = [t for t in lst if now - t < _WINDOW]
        lst.append(now)


def clear_login_failures(client_ip: str | None) -> None:
    if not client_ip:
        return
    with _lock:
        _failures.pop(client_ip, None)


def clear_all_login_rate_limit_state() -> None:
    """Для тестов и сброса между запусками."""
    with _lock:
        _failures.clear()
