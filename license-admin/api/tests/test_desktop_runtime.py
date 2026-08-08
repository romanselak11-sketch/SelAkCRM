from __future__ import annotations

import os
import sys
from pathlib import Path

from license_admin.desktop_runtime import (
    apply_desktop_environment_if_frozen,
    resolve_user_data_dir,
    run_desktop,
)
from license_admin.paths import find_project_root, project_layout


def test_resolve_user_data_dir_linux(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.delenv("LOCALAPPDATA", raising=False)
    monkeypatch.delenv("XDG_DATA_HOME", raising=False)
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    assert resolve_user_data_dir() == tmp_path / ".local" / "share" / "SelakCRM-LicenseAdmin"


def test_apply_desktop_noop_when_not_frozen(monkeypatch) -> None:
    monkeypatch.delenv("SELAKCRM_ROOT", raising=False)
    monkeypatch.setattr(sys, "frozen", False, raising=False)
    apply_desktop_environment_if_frozen()
    assert "SELAKCRM_ROOT" not in os.environ


def test_apply_desktop_sets_root_and_static_when_frozen(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    monkeypatch.delenv("SELAKCRM_ROOT", raising=False)
    monkeypatch.delenv("LICENSE_ADMIN_STATIC_DIR", raising=False)
    monkeypatch.delenv("LICENSE_ADMIN_PORT", raising=False)

    static = tmp_path / "frontend_dist"
    static.mkdir()
    (static / "index.html").write_text("<html/>", encoding="utf-8")

    apply_desktop_environment_if_frozen()

    root = Path(os.environ["SELAKCRM_ROOT"])
    assert root == tmp_path / ".local" / "share" / "SelakCRM-LicenseAdmin"
    assert (root / "license-admin" / "keys").is_dir()
    assert (root / "license-admin" / "data").is_dir()
    assert (root / "backend" / "selakcrm" / "licensing").is_dir()
    assert os.environ["LICENSE_ADMIN_STATIC_DIR"] == str(static)
    assert find_project_root() == root.resolve()
    layout = project_layout(root)
    assert layout["private_key"].parent == root / "license-admin" / "keys"


def test_apply_desktop_sets_std_streams_when_windowed(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    monkeypatch.setattr(sys, "_MEIPASS", str(tmp_path), raising=False)
    monkeypatch.setattr(sys, "platform", "linux")
    monkeypatch.setattr("pathlib.Path.home", lambda: tmp_path)
    monkeypatch.setattr(sys, "stdout", None, raising=False)
    monkeypatch.setattr(sys, "stderr", None, raising=False)

    apply_desktop_environment_if_frozen()
    assert sys.stdout is not None
    assert sys.stderr is not None


def test_run_desktop_falls_back_when_tray_deps_missing(monkeypatch) -> None:
    monkeypatch.delenv("LICENSE_ADMIN_TRAY", raising=False)
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
