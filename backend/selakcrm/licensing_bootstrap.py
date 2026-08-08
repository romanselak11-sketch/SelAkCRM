from __future__ import annotations

import json
import logging
import platform
from pathlib import Path

from selakcrm.licensing.guard import JsonFileLicenseCacheStore, JsonFileTrialStore, LicenseGuard
from selakcrm.licensing.models import TrialMarker

log = logging.getLogger(__name__)


class WindowsMirroredTrialStore:
    """Пишет trial-маркер в user-data, ProgramData и HKCU; при чтении берёт более ранний started_at."""

    def __init__(self, user_path: Path) -> None:
        self._user = JsonFileTrialStore(user_path)
        self._program_data = self._program_data_path()

    def load(self) -> TrialMarker | None:
        candidates: list[TrialMarker] = []
        for marker in (self._user.load(), self._load_program_data(), self._load_registry()):
            if marker is not None:
                candidates.append(marker)
        if not candidates:
            return None
        return min(candidates, key=lambda m: m.started_at)

    def save(self, marker: TrialMarker) -> None:
        self._user.save(marker)
        self._save_program_data(marker)
        self._save_registry(marker)

    def _program_data_path(self) -> Path | None:
        import os

        root = os.environ.get("PROGRAMDATA")
        if not root:
            return None
        return Path(root) / "SelakCRM" / "trial_marker.json"

    def _load_program_data(self) -> TrialMarker | None:
        if self._program_data is None:
            return None
        return JsonFileTrialStore(self._program_data).load()

    def _save_program_data(self, marker: TrialMarker) -> None:
        if self._program_data is None:
            return
        try:
            JsonFileTrialStore(self._program_data).save(marker)
        except OSError:
            log.debug("cannot write ProgramData trial marker", exc_info=True)

    def _load_registry(self) -> TrialMarker | None:
        if platform.system() != "Windows":
            return None
        try:
            import winreg  # type: ignore[attr-defined]

            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\SelakCRM") as key:
                raw, _ = winreg.QueryValueEx(key, "TrialMarker")
            data = json.loads(raw)
            return TrialMarker(
                hwid=str(data["hwid"]),
                started_at=str(data["started_at"]),
                last_seen_at=str(data["last_seen_at"]),
                trial_days=int(data.get("trial_days", 7)),
            )
        except Exception:
            return None

    def _save_registry(self, marker: TrialMarker) -> None:
        if platform.system() != "Windows":
            return
        try:
            import winreg  # type: ignore[attr-defined]

            payload = json.dumps(
                {
                    "hwid": marker.hwid,
                    "started_at": marker.started_at,
                    "last_seen_at": marker.last_seen_at,
                    "trial_days": marker.trial_days,
                },
                ensure_ascii=False,
            )
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\SelakCRM") as key:
                winreg.SetValueEx(key, "TrialMarker", 0, winreg.REG_SZ, payload)
        except Exception:
            log.debug("cannot write HKCU trial marker", exc_info=True)


def resolve_license_paths() -> tuple[Path, Path]:
    from selakcrm.desktop_runtime import resolve_user_data_dir

    data_dir = resolve_user_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "trial_marker.json", data_dir / "license_cache.json"


def load_trusted_public_keys() -> list[bytes]:
    from importlib.resources import files

    root = files("selakcrm.licensing")
    keys: list[bytes] = []
    for name in ("public.pem", "public_next.pem"):
        try:
            data = root.joinpath(name).read_bytes()
        except (FileNotFoundError, OSError, TypeError):
            continue
        if data.strip():
            keys.append(data)
    if not keys:
        raise RuntimeError("no trusted license public keys found in selakcrm.licensing")
    return keys


def build_guard(settings) -> LicenseGuard:
    trial_path, cache_path = resolve_license_paths()
    if platform.system() == "Windows":
        trial_store: JsonFileTrialStore | WindowsMirroredTrialStore = WindowsMirroredTrialStore(
            trial_path
        )
    else:
        trial_store = JsonFileTrialStore(trial_path)
    cache_store = JsonFileLicenseCacheStore(cache_path)
    return LicenseGuard(
        trial_store,
        cache_store,
        load_trusted_public_keys(),
        trial_days=settings.license_trial_days,
    )
