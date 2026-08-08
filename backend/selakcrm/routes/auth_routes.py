from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, get_current_user
from selakcrm.login_rate_limit import assert_login_allowed, clear_login_failures, register_login_failure
from selakcrm.schemas_base import StrictBody
from selakcrm.models import User
from selakcrm.security import create_access_token, verify_password
from selakcrm.serializers import user_public
from selakcrm.services.audit_log import audit_log
from selakcrm.services.role_permissions import permissions_for_role

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(StrictBody):
    login: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginOut(BaseModel):
    accessToken: str
    user: dict


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)) -> LoginOut:
    ip = request.client.host if request.client else None
    assert_login_allowed(ip)
    u = db.query(User).filter(User.login == body.login).first()
    if (
        not u
        or u.deletedAt is not None
        or not u.isActive
        or not verify_password(body.password, u.passwordHash)
    ):
        register_login_failure(ip)
        audit_log(
            db,
            user_id=None,
            action="LOGIN_FAILED",
            entity_type="Auth",
            entity_id=body.login,
            payload={"ip": ip},
        )
        raise HTTPException(
            401,
            detail={"statusCode": 401, "message": "Неверный логин или пароль", "error": "Unauthorized"},
        )
    clear_login_failures(ip)
    token = create_access_token(u.id, u.login, u.role)
    audit_log(
        db,
        user_id=u.id,
        action="LOGIN_SUCCESS",
        entity_type="Auth",
        entity_id=u.id,
        payload={"ip": ip},
    )
    return LoginOut(
        accessToken=token,
        user=user_public(u, permissions_for_role(db, u.role)),
    )


@router.post("/logout")
def logout(_: Annotated[JwtUser, Depends(get_current_user)]) -> dict:
    """Контракт docs/api-contracts.md: инвалидация токена на сервере не обязательна."""
    return {"ok": True}


@router.get("/me")
def me(
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    u = db.get(User, user.sub)
    assert u
    return user_public(u, permissions_for_role(db, u.role))

