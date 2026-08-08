from __future__ import annotations

import re
import secrets
from dataclasses import dataclass


class InvalidKeyFormat(ValueError):
    pass


# SAK-<id>-<secret>; secret never contains '-' so the regex stays unambiguous.
_FULL_KEY_RE = re.compile(r"^(SAK-[A-Z0-9]{4,16})-([A-Za-z0-9]{16,64})$")
_SECRET_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"


@dataclass(frozen=True)
class ParsedKey:
    key_id: str
    secret: str
    full_key: str


def issue_license_key(*, key_id_bytes: int = 4, secret_bytes: int = 24) -> ParsedKey:
    """Сгенерировать полный ключ без '-' в секрете (общий для CRM-тестов и License Admin)."""
    if key_id_bytes < 2 or key_id_bytes > 8:
        raise ValueError("key_id_bytes must be 2..8")
    key_id = f"SAK-{secrets.token_hex(key_id_bytes).upper()}"
    secret = "".join(secrets.choice(_SECRET_ALPHABET) for _ in range(secret_bytes))
    full_key = f"{key_id}-{secret}"
    return ParsedKey(key_id=key_id, secret=secret, full_key=full_key)


def parse_full_key(full_key: str) -> ParsedKey:
    raw = "".join(full_key.split())
    match = _FULL_KEY_RE.match(raw)
    if not match:
        raise InvalidKeyFormat("key must be 'SAK-XXXX-<secret>' without dashes in secret")
    key_id, secret = match.group(1), match.group(2)
    return ParsedKey(key_id=key_id, secret=secret, full_key=raw)
