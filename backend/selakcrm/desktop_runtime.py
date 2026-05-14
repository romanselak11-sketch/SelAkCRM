"""Переменные окружения и пути для упакованного десктопного запуска (PyInstaller)."""

from __future__ import annotations

import importlib
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


def _ensure_std_streams_for_windowed_exe() -> None:
    """
    В windowed-режиме PyInstaller (console=False) sys.stdout/sys.stderr могут быть None.
    Uvicorn/логирование ожидают наличие .isatty() у потока, поэтому подставляем devnull.
    """
    if getattr(sys, "stdout", None) is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115
    if getattr(sys, "stderr", None) is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115


def apply_desktop_environment_if_frozen() -> None:
    """Перед импортом приложения: БД и секреты в пользовательском каталоге, статика из _MEIPASS."""
    if not getattr(sys, "frozen", False):
        return
    _ensure_std_streams_for_windowed_exe()
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


def run_desktop() -> None:
    """
    Desktop-режим для Windows exe:
    - по умолчанию пытается поднять трей-иконку (если доступны pystray + Pillow)
    - иначе запускается как раньше (консольный uvicorn + открытие браузера)
    """
    tray_env = os.environ.get("SELAKCRM_TRAY", "").strip().lower()
    if tray_env in {"0", "false", "off", "no"}:
        run_desktop_uvicorn()
        return

    try:
        pystray = importlib.import_module("pystray")
        Image = importlib.import_module("PIL.Image")
        ImageDraw = importlib.import_module("PIL.ImageDraw")
        ImageFont = importlib.import_module("PIL.ImageFont")
    except Exception:
        run_desktop_uvicorn()
        return

    import uvicorn

    port = int(os.environ.get("SELAKCRM_PORT", "8765"))
    url = f"http://127.0.0.1:{port}/"

    def build_tray_image():
        size = 64

        # 1) Явно заданный путь
        env_icon = os.environ.get("SELAKCRM_TRAY_ICON", "").strip()
        candidates: list[Path] = []
        if env_icon:
            candidates.append(Path(env_icon))

        # 2) Вшитый в PyInstaller asset (backend/assets/selak.ico -> _MEIPASS/assets/selak.ico)
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            candidates.append(Path(meipass) / "assets" / "selak.ico")

        # 3) Локальный asset (для запуска не из exe)
        candidates.append(Path(__file__).resolve().parent.parent / "assets" / "selak.ico")

        for p in candidates:
            try:
                if p.is_file():
                    img = Image.open(str(p))
                    img = img.convert("RGBA")
                    img = img.resize((size, size))
                    return img
            except Exception:
                continue

        # Фолбэк: простая сгенерированная иконка
        bg = (30, 64, 175, 255)
        img = Image.new("RGBA", (size, size), bg)
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default()
        text = "CRM"
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        except Exception:
            tw, th = draw.textsize(text, font=font)
        draw.text(((size - tw) / 2, (size - th) / 2), text, fill=(255, 255, 255, 255), font=font)
        return img

    config = uvicorn.Config("selakcrm.main:app", host="127.0.0.1", port=port, log_level="info")
    server = uvicorn.Server(config)

    def run_server() -> None:
        server.run()

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    def open_ui(_icon=None, _item=None) -> None:
        webbrowser.open(url)

    def stop_service(icon, _item=None) -> None:
        server.should_exit = True
        try:
            icon.stop()
        except Exception:
            pass

    # Если сервер завершился сам — остановим иконку.
    def stop_tray_when_server_exits(icon) -> None:
        server_thread.join()
        try:
            icon.stop()
        except Exception:
            pass

    menu = pystray.Menu(
        pystray.MenuItem("Открыть", open_ui, default=True),
        pystray.MenuItem("Остановить сервис", stop_service),
    )
    icon = pystray.Icon("SelakCRM", build_tray_image(), "SelakCRM", menu)
    threading.Thread(target=stop_tray_when_server_exits, args=(icon,), daemon=True).start()
    open_ui()
    icon.run()
