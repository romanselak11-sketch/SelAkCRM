from __future__ import annotations

import os
from pathlib import Path


def find_project_root(start: Path | None = None) -> Path:
    """Корень монорепо SelAkCRM (есть backend/ + license-admin/)."""
    env = (os.environ.get("SELAKCRM_ROOT") or "").strip()
    if env:
        root = Path(env).expanduser().resolve()
        if _looks_like_project(root):
            return root
        raise RuntimeError(f"SELAKCRM_ROOT не похож на корень проекта: {root}")

    cur = (start or Path(__file__)).resolve()
    if cur.is_file():
        cur = cur.parent
    for candidate in (cur, *cur.parents):
        if _looks_like_project(candidate):
            return candidate
    raise RuntimeError(
        "Не найден корень SelAkCRM. Запускайте из репозитория или задайте SELAKCRM_ROOT."
    )


def _looks_like_project(path: Path) -> bool:
    return (path / "license-admin").is_dir() and (path / "backend" / "selakcrm").is_dir()


def project_layout(root: Path) -> dict[str, Path]:
    """Фиксированные пути внутри текущего проекта."""
    admin = root / "license-admin"
    keys = admin / "keys"
    data = admin / "data"
    return {
        "root": root,
        "admin": admin,
        "keys": keys,
        "data": data,
        "private_key": keys / "private.pem",
        "public_key": keys / "public.pem",
        "crm_public_key": root / "backend" / "selakcrm" / "licensing" / "public.pem",
    }
