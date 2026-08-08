from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy.orm import Session

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, require_permission
from selakcrm.permissions import CONFIGURABLE_ROLES
from selakcrm.schemas_base import StrictBody
from selakcrm.services.audit_log import audit_log
from selakcrm.services.role_permissions import get_role_permissions_matrix, set_role_permissions

router = APIRouter(prefix="/role-permissions", tags=["role-permissions"])


def _admin_perms(
    user: Annotated[JwtUser, Depends(require_permission("settings.role_permissions"))],
) -> JwtUser:
    return user


class RolePermissionsPutIn(StrictBody):
    role: str = Field(pattern="^(SUPER_MANAGER|MANAGER)$")
    permissions: list[str] = Field(default_factory=list)


@router.get("")
def get_matrix(
    _: Annotated[JwtUser, Depends(_admin_perms)],
    db: Session = Depends(get_db),
) -> dict:
    return get_role_permissions_matrix(db)


@router.put("")
def put_role_permissions(
    body: RolePermissionsPutIn,
    actor: Annotated[JwtUser, Depends(_admin_perms)],
    db: Session = Depends(get_db),
) -> dict:
    if body.role not in CONFIGURABLE_ROLES:
        raise HTTPException(
            400,
            detail={
                "statusCode": 400,
                "message": "Роль нельзя настраивать",
                "error": "Bad Request",
            },
        )
    try:
        saved = set_role_permissions(db, body.role, body.permissions)
    except ValueError:
        raise HTTPException(
            400,
            detail={
                "statusCode": 400,
                "message": "Роль нельзя настраивать",
                "error": "Bad Request",
            },
        )
    audit_log(
        db,
        user_id=actor.sub,
        action="ROLE_PERMISSIONS_UPDATE",
        entity_type="RolePermission",
        entity_id=body.role,
        payload={"permissions": saved},
    )
    return get_role_permissions_matrix(db)
