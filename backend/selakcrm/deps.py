from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.models import User
from selakcrm.security import decode_token

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
    return JwtUser(sub=sub, login=login or u.login, role=role)


def require_roles(*roles: str):
    def _inner(user: Annotated[JwtUser, Depends(get_current_user)]) -> JwtUser:
        if user.role not in roles:
            raise HTTPException(403, "Forbidden")
        return user

    return _inner
