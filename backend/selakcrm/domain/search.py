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


def token_lower(s: str) -> str:
    return s.lower()  # ru-RU в JS; для SQLite lower() достаточно


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
            lower(c."lastName") LIKE :{pk} ESCAPE '\\'
            OR lower(c."firstName") LIKE :{pk} ESCAPE '\\'
            OR lower(COALESCE(c."middleName", '')) LIKE :{pk} ESCAPE '\\'
            OR lower(c."phone") LIKE :{pk} ESCAPE '\\'
            OR lower(c."phoneNormalized") LIKE :{pk} ESCAPE '\\'
            OR EXISTS (
              SELECT 1 FROM "ClientPhone" cp
              WHERE cp."clientId" = c."id"
              AND (
                lower(cp."phone") LIKE :{pk} ESCAPE '\\'
                OR lower(cp."phoneNormalized") LIKE :{pk} ESCAPE '\\'
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
            lower(p."number") LIKE :{pk} ESCAPE '\\'
            OR lower(cl."lastName") LIKE :{pk} ESCAPE '\\'
            OR lower(cl."firstName") LIKE :{pk} ESCAPE '\\'
            OR lower(COALESCE(cl."middleName", '')) LIKE :{pk} ESCAPE '\\'
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
        parts.append(f"""lower(ic."name") LIKE :{pk} ESCAPE '\\'""")
    return " AND ".join(parts), params
