import os
import sys
from pathlib import Path

import pytest

from selakcrm.desktop_runtime import apply_desktop_environment_if_frozen, resolve_user_data_dir, run_desktop


def test_frozen_alembic_upgrade_head(monkeypatch, tmp_path):
    """Как при первом запуске exe: миграции из _MEIPASS на чистой SQLite."""
    import shutil
    import sys
    from alembic import command
    from alembic.config import Config

    backend = Path(__file__).resolve().parent.parent
    meipass = tmp_path / "meipass"
    meipass.mkdir()
    shutil.copytree(backend / "alembic", meipass / "alembic")
    shutil.copy(backend / "alembic.ini", meipass / "alembic.ini")

    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(meipass), raising=False)
    db_path = tmp_path / "probe.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")

    command.upgrade(Config(str(meipass / "alembic.ini")), "head")
    assert _has_column_sqlite(db_path, "RenewalTask", "renewedPolicyId")


def _has_column_sqlite(db_path: Path, table: str, column: str) -> bool:
    import sqlite3

    con = sqlite3.connect(db_path)
    try:
        rows = con.execute(f'PRAGMA table_info("{table}")').fetchall()
    finally:
        con.close()
    return any(r[1] == column for r in rows)


def test_resolve_user_data_dir_exists(monkeypatch, tmp_path):
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    monkeypatch.delenv("XDG_DATA_HOME", raising=False)
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    d = resolve_user_data_dir()
    assert d == tmp_path / ".local" / "share" / "SelakCRM"


def test_apply_desktop_noop_when_not_frozen(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)
    apply_desktop_environment_if_frozen()
    assert "DATABASE_URL" not in os.environ


def test_apply_desktop_sets_paths_when_frozen(monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    static = tmp_path / "frontend_dist"
    static.mkdir()
    (static / "index.html").write_text("<html/>", encoding="utf-8")

    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("JWT_SECRET", raising=False)
    monkeypatch.delenv("WEB_ORIGIN", raising=False)
    monkeypatch.delenv("SELAKCRM_STATIC_DIR", raising=False)

    apply_desktop_environment_if_frozen()

    assert "DATABASE_URL" in os.environ
    assert os.environ["DATABASE_URL"].startswith("sqlite:///")
    assert "JWT_SECRET" in os.environ
    assert os.environ["WEB_ORIGIN"].startswith("http://127.0.0.1:")
    assert os.environ["SELAKCRM_STATIC_DIR"] == str(static)

    apply_desktop_environment_if_frozen()
    assert os.environ["DATABASE_URL"].startswith("sqlite:///")


def test_apply_desktop_sets_std_streams_when_windowed(monkeypatch, tmp_path):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)

    monkeypatch.setattr(sys, "stdout", None, raising=False)
    monkeypatch.setattr(sys, "stderr", None, raising=False)

    apply_desktop_environment_if_frozen()
    assert sys.stdout is not None
    assert sys.stderr is not None


def test_run_desktop_falls_back_when_tray_deps_missing(monkeypatch):
    # Симулируем отсутствие pystray/Pillow: run_desktop должен не падать и перейти на uvicorn.run
    monkeypatch.delenv("SELAKCRM_TRAY", raising=False)

    calls = {"uvicorn_run": 0}

    class FakeUvicornModule:
        @staticmethod
        def run(*_args, **_kwargs):
            calls["uvicorn_run"] += 1

    monkeypatch.setitem(sys.modules, "uvicorn", FakeUvicornModule)

    import importlib

    real_import_module = importlib.import_module

    def fake_import_module(name: str):
        if name in {"pystray", "PIL.Image", "PIL.ImageDraw", "PIL.ImageFont"}:
            raise ImportError("missing")
        return real_import_module(name)

    monkeypatch.setattr(importlib, "import_module", fake_import_module)
    run_desktop()
    assert calls["uvicorn_run"] == 1
