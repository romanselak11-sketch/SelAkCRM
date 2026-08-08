from __future__ import annotations

from datetime import UTC, datetime


def utcnow() -> datetime:
    """UTC now в наивном виде для совместимости с текущей схемой DateTime."""
    return datetime.now(UTC).replace(tzinfo=None)


def parse_iso_datetime(value: str) -> datetime:
    """ISO-8601 → naive datetime; суффикс Z допускается."""
    text = value.replace("Z", "+00:00") if value.endswith("Z") else value
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt
