from __future__ import annotations

import json
from collections.abc import Callable
from datetime import datetime
from pathlib import Path
from typing import Protocol

from selakcrm.licensing.activation_code import (
    build_activation_request,
    verify_activation_code,
)
from selakcrm.licensing.hwid import compute_hwid
from selakcrm.licensing.keys import InvalidKeyFormat, parse_full_key
from selakcrm.licensing.models import (
    BlockedReason,
    GuardState,
    LicenseStatus,
    TrialMarker,
)
from selakcrm.licensing.trial import (
    is_clock_rollback,
    is_trial_expired,
    new_trial_marker,
    touch,
    trial_remaining_seconds,
)
from selakcrm.time_utils import utcnow


class TrialStore(Protocol):
    def load(self) -> TrialMarker | None: ...

    def save(self, marker: TrialMarker) -> None: ...


class LicenseCacheStore(Protocol):
    def load_full_key(self) -> str | None: ...

    def save_full_key(self, full_key: str | None) -> None: ...

    def load_activation_code(self) -> str | None: ...

    def save_activation_code(self, code: str | None) -> None: ...

    def load_commercial_used(self) -> bool: ...

    def save_commercial_used(self, used: bool) -> None: ...


class JsonFileTrialStore:
    def __init__(self, path: Path) -> None:
        self._path = path

    def load(self) -> TrialMarker | None:
        if not self._path.is_file():
            return None
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            return TrialMarker(
                hwid=str(data["hwid"]),
                started_at=str(data["started_at"]),
                last_seen_at=str(data["last_seen_at"]),
                trial_days=int(data.get("trial_days", 7)),
            )
        except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
            return None

    def save(self, marker: TrialMarker) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "hwid": marker.hwid,
            "started_at": marker.started_at,
            "last_seen_at": marker.last_seen_at,
            "trial_days": marker.trial_days,
        }
        self._path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


class JsonFileLicenseCacheStore:
    def __init__(self, path: Path) -> None:
        self._path = path

    def _read(self) -> dict:
        if not self._path.is_file():
            return {}
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _write(self, data: dict) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    def _load_str(self, field: str) -> str | None:
        value = self._read().get(field)
        return str(value) if isinstance(value, str) and value else None

    def _save_str(self, field: str, value: str | None) -> None:
        data = self._read()
        if value is None:
            data.pop(field, None)
        else:
            data[field] = value
        self._write(data)

    def load_full_key(self) -> str | None:
        return self._load_str("full_key")

    def save_full_key(self, full_key: str | None) -> None:
        self._save_str("full_key", full_key)

    def load_activation_code(self) -> str | None:
        return self._load_str("activation_code")

    def save_activation_code(self, code: str | None) -> None:
        self._save_str("activation_code", code)

    def load_commercial_used(self) -> bool:
        return bool(self._read().get("commercial_used"))

    def save_commercial_used(self, used: bool) -> None:
        data = self._read()
        data["commercial_used"] = bool(used)
        self._write(data)


class InMemoryTrialStore:
    def __init__(self) -> None:
        self._marker: TrialMarker | None = None

    def load(self) -> TrialMarker | None:
        return self._marker

    def save(self, marker: TrialMarker) -> None:
        self._marker = marker


class InMemoryLicenseCacheStore:
    def __init__(self) -> None:
        self._full_key: str | None = None
        self._activation_code: str | None = None
        self._commercial_used: bool = False

    def load_full_key(self) -> str | None:
        return self._full_key

    def save_full_key(self, full_key: str | None) -> None:
        self._full_key = full_key

    def load_activation_code(self) -> str | None:
        return self._activation_code

    def save_activation_code(self, code: str | None) -> None:
        self._activation_code = code

    def load_commercial_used(self) -> bool:
        return self._commercial_used

    def save_commercial_used(self, used: bool) -> None:
        self._commercial_used = bool(used)


class LicenseGuard:
    def __init__(
        self,
        trial_store: TrialStore,
        cache_store: LicenseCacheStore,
        trusted_public_keys: list[bytes],
        *,
        hwid: str | None = None,
        trial_days: int = 7,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._trial_store = trial_store
        self._cache_store = cache_store
        self._trusted_public_keys = trusted_public_keys
        self._hwid = hwid or compute_hwid()
        self._trial_days = trial_days
        self._clock = clock

    @property
    def hwid(self) -> str:
        return self._hwid

    def is_active(self) -> bool:
        return self.state().status in (LicenseStatus.DEMO, LicenseStatus.FULL)

    def full_key(self) -> str | None:
        return self._cache_store.load_full_key()

    def set_full_key(self, full_key: str | None) -> None:
        """Смена ключа обнуляет код активации: он выдавался под прежний key_id."""
        normalized = full_key.strip() if full_key else None
        if self._key_id(normalized) != self._key_id(self._cache_store.load_full_key()):
            self._cache_store.save_activation_code(None)
        self._cache_store.save_full_key(normalized)

    @staticmethod
    def _key_id(full_key: str | None) -> str | None:
        if not full_key:
            return None
        try:
            return parse_full_key(full_key).key_id
        except InvalidKeyFormat:
            return None

    def request_code(self) -> str | None:
        """Код запроса для вендора; None — если ключ ещё не введён или он битый."""
        full_key = self._cache_store.load_full_key()
        if not full_key:
            return None
        try:
            parsed = parse_full_key(full_key)
        except InvalidKeyFormat:
            return None
        return build_activation_request(parsed, self._hwid).encode()

    def redeem_activation_code(self, code: str) -> bool:
        """Проверить код ответа вендора и сохранить его при успехе."""
        full_key = self._cache_store.load_full_key()
        if not full_key:
            return False
        try:
            parsed = parse_full_key(full_key)
        except InvalidKeyFormat:
            return False
        if not verify_activation_code(code, parsed.key_id, self._hwid, self._trusted_public_keys):
            return False
        self._cache_store.save_activation_code("".join(code.split()))
        self.mark_commercial_used()
        return True

    def mark_commercial_used(self) -> None:
        self._cache_store.save_commercial_used(True)

    def clear_commercial_key(self) -> None:
        """Снять лицензию с этого компьютера.

        Демо не возвращается только если лицензия действительно работала: снятие
        ещё не активированного ключа не должно съедать остаток демо-периода.
        """
        was_commercial = self._cache_store.load_commercial_used()
        self._cache_store.save_full_key(None)
        self._cache_store.save_activation_code(None)
        if was_commercial:
            marker = new_trial_marker(self._hwid, now=self._clock(), trial_days=0)
            self._trial_store.save(marker)

    def state(self) -> GuardState:
        full_key = self._cache_store.load_full_key()
        if full_key:
            return self._commercial_state(full_key)
        return self._trial_state()

    def _trial_state(self) -> GuardState:
        if self._cache_store.load_commercial_used():
            return GuardState(status=LicenseStatus.BLOCKED, reason=BlockedReason.TRIAL_EXPIRED)
        now = self._clock()
        marker = self._trial_store.load()
        if marker is None:
            marker = new_trial_marker(self._hwid, now=now, trial_days=self._trial_days)
            self._trial_store.save(marker)
        else:
            if is_clock_rollback(marker, now):
                return GuardState(
                    status=LicenseStatus.BLOCKED,
                    reason=BlockedReason.CLOCK_ROLLBACK,
                )
            # Смена HWID не сбрасывает демо: сохраняем started_at, перепривязываем идентификатор.
            if marker.hwid != self._hwid:
                marker = TrialMarker(
                    hwid=self._hwid,
                    started_at=marker.started_at,
                    last_seen_at=marker.last_seen_at,
                    trial_days=marker.trial_days,
                )
            marker = touch(marker, now)
            self._trial_store.save(marker)
        if is_trial_expired(marker, now):
            return GuardState(status=LicenseStatus.BLOCKED, reason=BlockedReason.TRIAL_EXPIRED)
        remaining = max(0, trial_remaining_seconds(marker, now))
        return GuardState(status=LicenseStatus.DEMO, remaining_seconds=remaining)

    def _commercial_state(self, full_key: str) -> GuardState:
        try:
            parsed = parse_full_key(full_key)
        except InvalidKeyFormat:
            return GuardState(status=LicenseStatus.BLOCKED, reason=BlockedReason.INVALID_KEY)
        code = self._cache_store.load_activation_code()
        if not code:
            return GuardState(status=LicenseStatus.PENDING_ACTIVATION)
        if not verify_activation_code(code, parsed.key_id, self._hwid, self._trusted_public_keys):
            # Обычно это смена оборудования: код был выдан на прежний HWID.
            return GuardState(
                status=LicenseStatus.PENDING_ACTIVATION,
                reason=BlockedReason.CODE_MISMATCH,
            )
        self.mark_commercial_used()
        return GuardState(status=LicenseStatus.FULL)
