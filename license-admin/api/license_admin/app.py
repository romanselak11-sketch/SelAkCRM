from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from license_admin.service import LicenseAdminService

service = LicenseAdminService()
app = FastAPI(title="SelAkCRM License Admin")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5174", "http://localhost:5174"],
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
