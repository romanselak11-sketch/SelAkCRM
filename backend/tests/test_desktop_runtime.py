import os
import sys

import pytest

from selakcrm.desktop_runtime import apply_desktop_environment_if_frozen, resolve_user_data_dir


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
