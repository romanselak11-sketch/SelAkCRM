"""Переменные окружения и пути для упакованного десктопного запуска (PyInstaller)."""

from __future__ import annotations

import os
import secrets
import sys
import threading
import time
import webbrowser
from pathlib import Path


def resolve_user_data_dir() -> Path:
    """Каталог пользовательских данных (БД, jwt_secret) вне каталога установки."""
    if sys.platform == "win32":
        local = os.environ.get("LOCALAPPDATA")
        root = Path(local) if local else Path.home() / "AppData" / "Local"
        return root / "SelakCRM"
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "SelakCRM"
    return Path.home() / ".local" / "share" / "SelakCRM"


def _ensure_jwt_secret(data_dir: Path) -> None:
    secret_file = data_dir / "jwt_secret.txt"
    if not secret_file.is_file():
        secret_file.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    os.environ.setdefault("JWT_SECRET", secret_file.read_text(encoding="utf-8").strip())


def apply_desktop_environment_if_frozen() -> None:
    """Перед импортом приложения: БД и секреты в пользовательском каталоге, статика из _MEIPASS."""
    if not getattr(sys, "frozen", False):
        return
    data_dir = resolve_user_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = data_dir / "selakcrm.db"
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    _ensure_jwt_secret(data_dir)
    port = os.environ.get("SELAKCRM_PORT", "8765")
    os.environ.setdefault("WEB_ORIGIN", f"http://127.0.0.1:{port}")
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        static_rel = Path(meipass) / "frontend_dist"
        if (static_rel / "index.html").is_file():
            os.environ.setdefault("SELAKCRM_STATIC_DIR", str(static_rel))


def run_desktop_uvicorn() -> None:
    """Uvicorn + открытие браузера (после apply_desktop_environment_if_frozen)."""
    import uvicorn

    port = int(os.environ.get("SELAKCRM_PORT", "8765"))
    url = f"http://127.0.0.1:{port}/"

    def open_browser() -> None:
        time.sleep(0.9)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("selakcrm.main:app", host="127.0.0.1", port=port, log_level="info")
