from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.models import User
from selakcrm.security import decode_token
from selakcrm.services.role_permissions import role_has_permission

security = HTTPBearer(auto_error=False)


class JwtUser:
    __slots__ = ("sub", "login", "role")

    def __init__(self, sub: str, login: str, role: str) -> None:
        self.sub = sub
        self.login = login
        self.role = role


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> JwtUser:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(401, "Unauthorized")
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(401, "Unauthorized")
    sub = payload.get("sub")
    login = payload.get("login")
    role = payload.get("role")
    if not sub or not role:
        raise HTTPException(401, "Unauthorized")
    u = db.get(User, sub)
    if not u or u.deletedAt is not None or not u.isActive:
        raise HTTPException(401, "Unauthorized")
    return JwtUser(sub=sub, login=login or u.login, role=u.role)


def require_roles(*roles: str):
    def _inner(user: Annotated[JwtUser, Depends(get_current_user)]) -> JwtUser:
        if user.role not in roles:
            raise HTTPException(403, "Forbidden")
        return user

    return _inner


def _forbidden() -> HTTPException:
    return HTTPException(
        403,
        detail={"statusCode": 403, "message": "Forbidden", "error": "Forbidden"},
    )


def require_permission(*permissions: str):
    """Пользователь должен иметь все указанные права."""

    def _inner(
        user: Annotated[JwtUser, Depends(get_current_user)],
        db: Annotated[Session, Depends(get_db)],
    ) -> JwtUser:
        for perm in permissions:
            if not role_has_permission(db, user.role, perm):
                raise _forbidden()
        return user

    return _inner


def assert_permission(db: Session, user: JwtUser, *permissions: str) -> None:
    for perm in permissions:
        if not role_has_permission(db, user.role, perm):
            raise _forbidden()
