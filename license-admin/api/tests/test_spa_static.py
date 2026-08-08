from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from license_admin.app import _mount_spa_static_if_configured


def test_spa_static_serves_index(tmp_path: Path, monkeypatch) -> None:
    static = tmp_path / "frontend_dist"
    assets = static / "assets"
    assets.mkdir(parents=True)
    (static / "index.html").write_text("<html>admin</html>", encoding="utf-8")
    (assets / "app.js").write_text("console.log(1)", encoding="utf-8")

    monkeypatch.setenv("LICENSE_ADMIN_STATIC_DIR", str(static))
    app = FastAPI()
    _mount_spa_static_if_configured(app)
    client = TestClient(app)

    assert client.get("/").status_code == 200
    assert "admin" in client.get("/").text
    assert client.get("/assets/app.js").status_code == 200
