"""Переменные окружения и пути для упакованного License Admin (PyInstaller)."""

from __future__ import annotations

import importlib
import os
import sys
import threading
import time
import webbrowser
from pathlib import Path


def resolve_user_data_dir() -> Path:
    """Каталог данных вендора (keys, vault) вне каталога установки exe."""
    if sys.platform == "win32":
        local = os.environ.get("LOCALAPPDATA")
        root = Path(local) if local else Path.home() / "AppData" / "Local"
        return root / "SelakCRM-LicenseAdmin"
    xdg = os.environ.get("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "SelakCRM-LicenseAdmin"
    return Path.home() / ".local" / "share" / "SelakCRM-LicenseAdmin"


def _ensure_std_streams_for_windowed_exe() -> None:
    """В windowed-режиме PyInstaller sys.stdout/stderr могут быть None."""
    if getattr(sys, "stdout", None) is None:
        sys.stdout = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115
    if getattr(sys, "stderr", None) is None:
        sys.stderr = open(os.devnull, "w", encoding="utf-8")  # noqa: SIM115


def _ensure_synthetic_project_root(data_home: Path) -> Path:
    """
    Структура как у монорепо, чтобы project_layout / sync public.pem работали без репозитория.
    """
    root = data_home
    (root / "license-admin" / "keys").mkdir(parents=True, exist_ok=True)
    (root / "license-admin" / "data").mkdir(parents=True, exist_ok=True)
    (root / "backend" / "selakcrm" / "licensing").mkdir(parents=True, exist_ok=True)
    return root


def apply_desktop_environment_if_frozen() -> None:
    """Перед импортом app: SELAKCRM_ROOT в user-data, статика из _MEIPASS."""
    if not getattr(sys, "frozen", False):
        return
    _ensure_std_streams_for_windowed_exe()
    data_home = resolve_user_data_dir()
    data_home.mkdir(parents=True, exist_ok=True)
    project_root = _ensure_synthetic_project_root(data_home)
    os.environ.setdefault("SELAKCRM_ROOT", str(project_root))
    port = os.environ.get("LICENSE_ADMIN_PORT", "8766")
    os.environ.setdefault("LICENSE_ADMIN_PORT", port)
    meipass = getattr(sys, "_MEIPASS", None)
    if meipass:
        static_rel = Path(meipass) / "frontend_dist"
        if (static_rel / "index.html").is_file():
            os.environ.setdefault("LICENSE_ADMIN_STATIC_DIR", str(static_rel))


def run_desktop_uvicorn() -> None:
    """Uvicorn + открытие браузера (после apply_desktop_environment_if_frozen)."""
    import uvicorn

    port = int(os.environ.get("LICENSE_ADMIN_PORT", "8766"))
    url = f"http://127.0.0.1:{port}/"

    def open_browser() -> None:
        time.sleep(0.9)
        webbrowser.open(url)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("license_admin.app:app", host="127.0.0.1", port=port, log_level="info")


def _write_crash_log(exc: BaseException) -> None:
    try:
        log_dir = resolve_user_data_dir()
        log_dir.mkdir(parents=True, exist_ok=True)
        import traceback

        (log_dir / "startup_error.log").write_text(traceback.format_exc(), encoding="utf-8")
    except Exception:
        pass


def run_desktop() -> None:
    """
    Desktop-режим для Windows exe:
    - трей (pystray + Pillow), иначе uvicorn + браузер.
    """
    try:
        _run_desktop_inner()
    except Exception as exc:
        _write_crash_log(exc)
        raise


def _run_desktop_inner() -> None:
    tray_env = os.environ.get("LICENSE_ADMIN_TRAY", "").strip().lower()
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

    port = int(os.environ.get("LICENSE_ADMIN_PORT", "8766"))
    url = f"http://127.0.0.1:{port}/"

    def build_tray_image():
        size = 64
        env_icon = os.environ.get("LICENSE_ADMIN_TRAY_ICON", "").strip()
        candidates: list[Path] = []
        if env_icon:
            candidates.append(Path(env_icon))
        meipass = getattr(sys, "_MEIPASS", None)
        if meipass:
            candidates.append(Path(meipass) / "assets" / "selak.ico")
        candidates.append(
            Path(__file__).resolve().parents[3] / "backend" / "assets" / "selak.ico"
        )
        for p in candidates:
            try:
                if p.is_file():
                    img = Image.open(str(p))
                    img = img.convert("RGBA")
                    img = img.resize((size, size))
                    return img
            except Exception:
                continue
        bg = (15, 118, 110, 255)
        img = Image.new("RGBA", (size, size), bg)
        draw = ImageDraw.Draw(img)
        font = ImageFont.load_default()
        text = "LIC"
        try:
            bbox = draw.textbbox((0, 0), text, font=font)
            tw = bbox[2] - bbox[0]
            th = bbox[3] - bbox[1]
        except Exception:
            tw, th = draw.textsize(text, font=font)
        draw.text(((size - tw) / 2, (size - th) / 2), text, fill=(255, 255, 255, 255), font=font)
        return img

    config = uvicorn.Config(
        "license_admin.app:app", host="127.0.0.1", port=port, log_level="info"
    )
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

    def stop_tray_when_server_exits(icon) -> None:
        server_thread.join()
        try:
            icon.stop()
        except Exception:
            pass

    menu = pystray.Menu(
        pystray.MenuItem("Открыть", open_ui, default=True),
        pystray.MenuItem("Остановить", stop_service),
    )
    icon = pystray.Icon(
        "SelakCRM-LicenseAdmin",
        build_tray_image(),
        "SelakCRM License Admin",
        menu,
    )
    threading.Thread(target=stop_tray_when_server_exits, args=(icon,), daemon=True).start()
    open_ui()
    icon.run()
