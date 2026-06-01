"""Поисковые токены и SQL-фрагменты (как в Nest search-sql / search-tokens)."""

from __future__ import annotations

import re


def parse_search_tokens(q: str | None) -> list[str]:
    raw = (q or "").strip()
    if not raw:
        return []
    return [t[:120] for t in re.split(r"\s+", raw) if t][:10]


def escape_like_pattern(s: str) -> str:
    return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def search_normalize(s: str) -> str:
    """Регистронезависимое сравнение для кириллицы (SQLite lower() — только ASCII)."""
    return s.casefold().replace("ё", "е")


def token_lower(s: str) -> str:
    return search_normalize(s)


def sqlite_unicode_lower(value: str | None) -> str:
    if value is None:
        return ""
    return search_normalize(str(value))


def register_sqlite_search_functions(dbapi_connection) -> None:
    create = getattr(dbapi_connection, "create_function", None)
    if create is None:
        return
    create("unicode_lower", 1, sqlite_unicode_lower)


def client_search_where_clause(tokens: list[str]) -> tuple[str, dict]:
    """Возвращает SQL AND-условие и параметры для SQLite."""
    parts: list[str] = []
    params: dict[str, str] = {}
    for i, token in enumerate(tokens):
        pattern = f"%{escape_like_pattern(token_lower(token))}%"
        pk = f"t{i}"
        params[pk] = pattern
        parts.append(
            f"""(
            unicode_lower(c."lastName") LIKE :{pk} ESCAPE '\\'
            OR unicode_lower(c."firstName") LIKE :{pk} ESCAPE '\\'
            OR unicode_lower(COALESCE(c."middleName", '')) LIKE :{pk} ESCAPE '\\'
            OR unicode_lower(c."phone") LIKE :{pk} ESCAPE '\\'
            OR unicode_lower(c."phoneNormalized") LIKE :{pk} ESCAPE '\\'
            OR EXISTS (
              SELECT 1 FROM "ClientPhone" cp
              WHERE cp."clientId" = c."id"
              AND (
                unicode_lower(cp."phone") LIKE :{pk} ESCAPE '\\'
                OR unicode_lower(cp."phoneNormalized") LIKE :{pk} ESCAPE '\\'
              )
            )
            )"""
        )
    return " AND ".join(parts), params


def policy_search_where_clause(tokens: list[str]) -> tuple[str, dict]:
    parts: list[str] = []
    params: dict[str, str] = {}
    for i, token in enumerate(tokens):
        pattern = f"%{escape_like_pattern(token_lower(token))}%"
        pk = f"t{i}"
        params[pk] = pattern
        parts.append(
            f"""(
            unicode_lower(p."number") LIKE :{pk} ESCAPE '\\'
            OR unicode_lower(cl."lastName") LIKE :{pk} ESCAPE '\\'
            OR unicode_lower(cl."firstName") LIKE :{pk} ESCAPE '\\'
            OR unicode_lower(COALESCE(cl."middleName", '')) LIKE :{pk} ESCAPE '\\'
            )"""
        )
    return " AND ".join(parts), params


def company_search_where_clause(tokens: list[str]) -> tuple[str, dict]:
    parts: list[str] = []
    params: dict[str, str] = {}
    for i, token in enumerate(tokens):
        pattern = f"%{escape_like_pattern(token_lower(token))}%"
        pk = f"t{i}"
        params[pk] = pattern
        parts.append(f"""unicode_lower(ic."name") LIKE :{pk} ESCAPE '\\'""")
    return " AND ".join(parts), params
