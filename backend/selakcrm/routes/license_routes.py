from __future__ import annotations

import importlib.metadata
import threading
import time
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import Field
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.licensing.guard import LicenseGuard
from selakcrm.licensing.keys import InvalidKeyFormat, parse_full_key
from selakcrm.licensing.models import LicenseStatus
from selakcrm.models import User
from selakcrm.schemas_base import StrictBody
from selakcrm.security import decode_token

router = APIRouter(prefix="/license", tags=["license"])
_optional_bearer = HTTPBearer(auto_error=False)

_rate_lock = threading.Lock()
_rate_last: dict[str, float] = {}


def _guard(request: Request) -> LicenseGuard:
    guard = getattr(request.app.state, "license_guard", None)
    if guard is None:
        raise HTTPException(
            status_code=503,
            detail={
                "statusCode": 503,
                "message": "Лицензионный модуль не инициализирован",
                "error": "Service Unavailable",
            },
        )
    return guard


def _product_version() -> str:
    try:
        return importlib.metadata.version("selakcrm-api")
    except importlib.metadata.PackageNotFoundError:
        return "0.0.0"


def _status_payload(guard: LicenseGuard) -> dict[str, Any]:
    state = guard.state()
    return {
        "status": state.status.value,
        "reason": state.reason.value if state.reason else None,
        "remainingSeconds": state.remaining_seconds,
        "hwid": guard.hwid,
        "requestCode": guard.request_code(),
        "productVersion": _product_version(),
    }


def _rate_limit(bucket: str, seconds: float = 3.0) -> None:
    now = time.monotonic()
    with _rate_lock:
        last = _rate_last.get(bucket, 0.0)
        if now - last < seconds:
            raise HTTPException(
                status_code=429,
                detail={
                    "statusCode": 429,
                    "message": "Слишком частые запросы, подождите несколько секунд",
                    "error": "Too Many Requests",
                },
            )
        _rate_last[bucket] = now


def _require_super_admin(
    db: Session,
    creds: HTTPAuthorizationCredentials | None,
) -> None:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Unauthorized")
    try:
        payload = decode_token(creds.credentials)
    except Exception as exc:
        raise HTTPException(401, "Unauthorized") from exc
    if payload.get("role") != "SUPER_ADMIN":
        raise HTTPException(
            status_code=403,
            detail={"statusCode": 403, "message": "Forbidden", "error": "Forbidden"},
        )
    user = db.get(User, payload.get("sub"))
    if not user or user.deletedAt is not None or not user.isActive or user.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=403,
            detail={"statusCode": 403, "message": "Forbidden", "error": "Forbidden"},
        )


@router.get("/status")
def license_status(request: Request) -> dict[str, Any]:
    return _status_payload(_guard(request))


class ActivateIn(StrictBody):
    full_key: str = Field(min_length=3)


@router.post("/activate")
def license_activate(
    body: ActivateIn,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_optional_bearer)],
) -> dict[str, Any]:
    _rate_limit("activate")
    guard = _guard(request)
    if guard.state().status == LicenseStatus.FULL:
        _require_super_admin(db, creds)
    try:
        parse_full_key(body.full_key)
    except InvalidKeyFormat as exc:
        raise HTTPException(
            status_code=400,
            detail={"statusCode": 400, "message": "Неверный формат ключа", "error": "Bad Request"},
        ) from exc
    guard.set_full_key(body.full_key)
    return _status_payload(guard)


class RedeemIn(StrictBody):
    code: str = Field(min_length=8)


@router.post("/redeem")
def license_redeem(body: RedeemIn, request: Request) -> dict[str, Any]:
    _rate_limit("redeem")
    guard = _guard(request)
    if not guard.full_key():
        raise HTTPException(
            status_code=409,
            detail={
                "statusCode": 409,
                "message": "Сначала введите лицензионный ключ",
                "error": "Conflict",
            },
        )
    if not guard.redeem_activation_code(body.code):
        raise HTTPException(
            status_code=400,
            detail={
                "statusCode": 400,
                "message": "Код активации не подходит: проверьте, что он выдан для этого ключа "
                "и этого компьютера",
                "error": "Bad Request",
            },
        )
    return _status_payload(guard)


@router.post("/deactivate")
def license_deactivate(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_optional_bearer)],
) -> dict[str, Any]:
    guard = _guard(request)
    if not guard.full_key():
        raise HTTPException(
            status_code=409,
            detail={"statusCode": 409, "message": "Ключ не задан", "error": "Conflict"},
        )
    if guard.state().status == LicenseStatus.FULL:
        _require_super_admin(db, creds)
    guard.clear_commercial_key()
    return _status_payload(guard)
