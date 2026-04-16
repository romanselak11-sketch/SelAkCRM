from __future__ import annotations

from datetime import UTC, datetime


def utcnow() -> datetime:
    """UTC now в наивном виде для совместимости с текущей схемой DateTime."""
    return datetime.now(UTC).replace(tzinfo=None)
