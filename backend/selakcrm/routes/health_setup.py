from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.schemas_base import StrictBody
from selakcrm.ids import new_cuid
from selakcrm.models import AppSetting, User
from selakcrm.security import hash_password
from selakcrm.time_utils import utcnow

router = APIRouter(tags=["setup"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "selakcrm-api"}


class SetupStatusOut(BaseModel):
    needsSetup: bool


@router.get("/setup/status", response_model=SetupStatusOut)
def setup_status(db: Session = Depends(get_db)) -> SetupStatusOut:
    row = db.get(AppSetting, "setup_completed")
    needs = row is None or row.value != "true"
    return SetupStatusOut(needsSetup=needs)


class SetupCompleteIn(StrictBody):
    adminLogin: str = Field(min_length=2)
    adminPassword: str = Field(min_length=10)


@router.post("/setup/complete")
def setup_complete(body: SetupCompleteIn, db: Session = Depends(get_db)) -> dict:
    row = db.get(AppSetting, "setup_completed")
    if row is not None and row.value == "true":
        raise HTTPException(
            409,
            detail={"statusCode": 409, "message": "Установка уже завершена", "error": "Conflict"},
        )
    now = utcnow()
    u = User(
        id=new_cuid(),
        login=body.adminLogin,
        passwordHash=hash_password(body.adminPassword),
        role="SUPER_ADMIN",
        theme="light",
        isActive=True,
        createdAt=now,
        updatedAt=now,
    )
    db.add(u)
    db.add(AppSetting(key="setup_completed", value="true"))
    return {"ok": True}
