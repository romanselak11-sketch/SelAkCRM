from __future__ import annotations

import platform
import re
import subprocess
from pathlib import Path

from selakcrm.licensing.crypto import sha256_hex


def machine_seed() -> str:
    system = platform.system()
    if system == "Windows":
        guid = _windows_machine_guid()
        if guid:
            return guid
        return str(__import__("uuid").getnode())
    if system == "Darwin":
        uid = _darwin_platform_uuid()
        if uid:
            return uid
    if system == "Linux":
        mid = _linux_machine_id()
        if mid:
            return mid
    import uuid

    return f"{uuid.getnode()}:{platform.node()}"


def compute_hwid(seed: str | None = None) -> str:
    material = f"{seed if seed is not None else machine_seed()}:{platform.system()}"
    return "hw_" + sha256_hex(material)[:32]


def _windows_machine_guid() -> str | None:
    try:
        import winreg  # type: ignore[attr-defined]

        with winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Cryptography",
        ) as key:
            value, _ = winreg.QueryValueEx(key, "MachineGuid")
            if isinstance(value, str) and value.strip():
                return value.strip()
    except Exception:
        return None
    return None


def _darwin_platform_uuid() -> str | None:
    try:
        out = subprocess.check_output(
            ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
            text=True,
            timeout=5,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    match = re.search(r'"IOPlatformUUID"\s*=\s*"([^"]+)"', out)
    if match:
        return match.group(1).strip()
    return None


def _linux_machine_id() -> str | None:
    for path in (Path("/etc/machine-id"), Path("/var/lib/dbus/machine-id")):
        try:
            text = path.read_text(encoding="utf-8").strip()
            if text:
                return text
        except OSError:
            continue
    return None
