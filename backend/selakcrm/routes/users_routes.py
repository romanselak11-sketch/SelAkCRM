from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.schemas_base import StrictBody
from selakcrm.deps import JwtUser, get_current_user, require_roles
from selakcrm.ids import new_cuid
from selakcrm.models import User
from selakcrm.security import hash_password
from selakcrm.serializers import _iso
from selakcrm.services.audit_log import audit_log
from selakcrm.time_utils import utcnow

router = APIRouter(prefix="/users", tags=["users"])

MAX_USERS = 10


def _admin(user: Annotated[JwtUser, Depends(require_roles("SUPER_ADMIN"))]) -> JwtUser:
    return user


@router.get("")
def list_users(
    _: Annotated[JwtUser, Depends(_admin)],
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.query(User)
        .filter(User.deletedAt.is_(None))
        .order_by(User.login)
        .all()
    )
    return [
        {
            "id": u.id,
            "login": u.login,
            "role": u.role,
            "isActive": u.isActive,
            "theme": u.theme,
            "createdAt": _iso(u.createdAt),
        }
        for u in rows
    ]


class CreateUserIn(StrictBody):
    login: str = Field(min_length=2)
    password: str = Field(min_length=10)
    role: str = Field(pattern="^(SUPER_ADMIN|SUPER_MANAGER|MANAGER)$")
    isActive: bool | None = True


@router.post("")
def create_user(
    body: CreateUserIn,
    actor: Annotated[JwtUser, Depends(_admin)],
    db: Session = Depends(get_db),
) -> dict:
    n = db.query(User).filter(User.deletedAt.is_(None), User.isActive == True).count()  # noqa: E712
    if n >= MAX_USERS:
        raise HTTPException(
            409,
            detail={
                "statusCode": 409,
                "message": f"Достигнут лимит {MAX_USERS} активных пользователей",
                "error": "Conflict",
            },
        )
    now = utcnow()
    u = User(
        id=new_cuid(),
        login=body.login,
        passwordHash=hash_password(body.password),
        role=body.role,
        isActive=body.isActive if body.isActive is not None else True,
        theme="light",
        createdAt=now,
        updatedAt=now,
    )
    db.add(u)
    db.flush()
    audit_log(
        db,
        user_id=actor.sub,
        action="USER_CREATE",
        entity_type="User",
        entity_id=u.id,
        payload={"login": u.login, "role": u.role},
    )
    return {"id": u.id, "login": u.login, "role": u.role, "isActive": u.isActive, "theme": u.theme}


class UpdateUserIn(StrictBody):
    role: str | None = Field(default=None, pattern="^(SUPER_ADMIN|SUPER_MANAGER|MANAGER)$")
    isActive: bool | None = None
    password: str | None = Field(default=None, min_length=10)


@router.patch("/{user_id}")
def update_user(
    user_id: str,
    body: UpdateUserIn,
    actor: Annotated[JwtUser, Depends(_admin)],
    db: Session = Depends(get_db),
) -> dict:
    u = db.get(User, user_id)
    if not u or u.deletedAt is not None:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    if body.isActive is True and not u.isActive:
        n = db.query(User).filter(User.deletedAt.is_(None), User.isActive == True).count()  # noqa: E712
        if n >= MAX_USERS:
            raise HTTPException(
                409,
                detail={
                    "statusCode": 409,
                    "message": f"Достигнут лимит {MAX_USERS} активных пользователей",
                    "error": "Conflict",
                },
            )
    if body.role is not None:
        u.role = body.role
    if body.isActive is not None:
        u.isActive = body.isActive
    if body.password:
        u.passwordHash = hash_password(body.password)
    audit_log(
        db,
        user_id=actor.sub,
        action="USER_UPDATE",
        entity_type="User",
        entity_id=user_id,
        payload={"fields": [k for k, v in body.model_dump().items() if v is not None]},
    )
    if body.password:
        audit_log(db, user_id=actor.sub, action="USER_PASSWORD_SET_BY_ADMIN", entity_type="User", entity_id=user_id, payload={})
    return {"id": u.id, "login": u.login, "role": u.role, "isActive": u.isActive, "theme": u.theme}


@router.post("/{user_id}/archive")
def archive_user(
    user_id: str,
    actor: Annotated[JwtUser, Depends(_admin)],
    db: Session = Depends(get_db),
) -> dict:
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    u.deletedAt = utcnow()
    u.isActive = False
    audit_log(db, user_id=actor.sub, action="USER_ARCHIVE", entity_type="User", entity_id=user_id, payload={"login": u.login})
    return {"ok": True}


@router.post("/{user_id}/restore")
def restore_user(
    user_id: str,
    actor: Annotated[JwtUser, Depends(_admin)],
    db: Session = Depends(get_db),
) -> dict:
    n = db.query(User).filter(User.deletedAt.is_(None), User.isActive == True).count()  # noqa: E712
    if n >= MAX_USERS:
        raise HTTPException(
            409,
            detail={
                "statusCode": 409,
                "message": f"Достигнут лимит {MAX_USERS} активных пользователей",
                "error": "Conflict",
            },
        )
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    u.deletedAt = None
    u.isActive = True
    audit_log(db, user_id=actor.sub, action="USER_RESTORE", entity_type="User", entity_id=user_id, payload={})
    return {"ok": True}
