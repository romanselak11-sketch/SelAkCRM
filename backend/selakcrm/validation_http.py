"""Формат ошибок валидации как у NestJS (class-validator + ValidationPipe)."""

from __future__ import annotations

from typing import Any


def nest_validation_messages(errors: list[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for err in errors:
        t = err.get("type")
        loc = err.get("loc") or ()
        if t == "extra_forbidden" and loc:
            name = loc[-1]
            out.append(f"property {name} should not exist")
            continue
        msg = str(err.get("msg") or "")
        parts = [str(x) for x in loc if x not in ("body", "query", "path")]
        path = ".".join(parts)
        if path and msg:
            out.append(f"{path}: {msg}")
        elif msg:
            out.append(msg)
        else:
            out.append(str(err))
    return out if out else ["Validation failed"]
