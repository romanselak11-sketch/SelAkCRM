from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.staticfiles import StaticFiles

from license_admin.service import LicenseAdminService

service = LicenseAdminService()
app = FastAPI(title="SelAkCRM License Admin")
_cors_origins = [
    "http://127.0.0.1:5174",
    "http://localhost:5174",
    "http://127.0.0.1:8766",
    "http://localhost:8766",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UnlockIn(BaseModel):
    password: str = Field(min_length=6)


class CreateIn(BaseModel):
    note: str = ""
    maxSeats: int | None = Field(default=1, ge=1)


class ActivateIn(BaseModel):
    requestCode: str
    label: str | None = None


class DeallocateIn(BaseModel):
    hwid: str


def _ok_or_400(fn):
    try:
        return fn()
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(404, str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.get("/api/status")
def status() -> dict[str, Any]:
    return {
        "unlocked": service.state.unlocked,
        "paths": service.project_info(),
    }


@app.post("/api/unlock")
def unlock(body: UnlockIn) -> dict[str, Any]:
    return _ok_or_400(lambda: (service.unlock(body.password), {"ok": True})[1])


@app.post("/api/ensure-keys")
def ensure_keys() -> dict[str, str]:
    return _ok_or_400(service.ensure_keys)


@app.get("/api/licenses")
def licenses() -> list[dict[str, Any]]:
    return _ok_or_400(service.list_licenses)


@app.post("/api/licenses")
def create_license(body: CreateIn) -> dict[str, Any]:
    return _ok_or_400(lambda: service.create_license(note=body.note, max_seats=body.maxSeats))


@app.post("/api/licenses/{license_id}/revoke")
def revoke(license_id: str) -> dict[str, bool]:
    return _ok_or_400(lambda: (service.revoke(license_id), {"ok": True})[1])


@app.post("/api/licenses/{license_id}/deallocate")
def deallocate(license_id: str, body: DeallocateIn) -> dict[str, bool]:
    return _ok_or_400(lambda: (service.deallocate(license_id, body.hwid), {"ok": True})[1])


@app.post("/api/licenses/{license_id}/reveal")
def reveal(license_id: str) -> dict[str, str]:
    return _ok_or_400(lambda: {"fullKey": service.reveal_key(license_id)})


@app.post("/api/activate")
def activate(body: ActivateIn) -> dict[str, Any]:
    return _ok_or_400(lambda: service.issue_activation_code(body.requestCode, body.label))


@app.get("/api/audit")
def audit() -> list[dict[str, Any]]:
    return list(reversed(service.state.audit[-100:]))


def _mount_spa_static_if_configured(application: FastAPI) -> None:
    """Раздача собранного Vite (LICENSE_ADMIN_STATIC_DIR) и fallback на index.html."""
    raw = os.environ.get("LICENSE_ADMIN_STATIC_DIR", "").strip()
    if not raw:
        return
    static_dir = Path(raw)
    index = static_dir / "index.html"
    if not index.is_file():
        return
    assets = static_dir / "assets"
    if assets.is_dir():
        application.mount("/assets", StaticFiles(directory=str(assets)), name="spa_assets")

    @application.get("/{full_path:path}")
    def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        try:
            candidate = (static_dir / full_path).resolve()
        except OSError:
            return FileResponse(index)
        root = static_dir.resolve()
        if not candidate.is_relative_to(root):
            return FileResponse(index)
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(index)


_mount_spa_static_if_configured(app)
