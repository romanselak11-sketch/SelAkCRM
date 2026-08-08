"""Чтение и сохранение матрицы прав ролей."""

from __future__ import annotations

from sqlalchemy.orm import Session

from selakcrm.models import RolePermission
from selakcrm.permissions import (
    CONFIGURABLE_ROLES,
    LOCKED_ROLE,
    catalog_for_api,
    default_permissions_for_role,
    normalize_permission_list,
)
from selakcrm.time_utils import utcnow


def ensure_role_permission_rows(db: Session) -> None:
    """Создаёт строки для настраиваемых ролей с дефолтами, если их ещё нет."""
    now = utcnow()
    for role in CONFIGURABLE_ROLES:
        row = db.get(RolePermission, role)
        if row is None:
            db.add(
                RolePermission(
                    role=role,
                    permissions=default_permissions_for_role(role),
                    updatedAt=now,
                )
            )
    db.flush()


def permissions_for_role(db: Session, role: str) -> list[str]:
    if role == LOCKED_ROLE:
        return default_permissions_for_role(LOCKED_ROLE)
    ensure_role_permission_rows(db)
    row = db.get(RolePermission, role)
    if row is None:
        return default_permissions_for_role(role)
    return list(row.permissions or [])


def role_has_permission(db: Session, role: str, permission: str) -> bool:
    return permission in permissions_for_role(db, role)


def get_role_permissions_matrix(db: Session) -> dict:
    ensure_role_permission_rows(db)
    roles: dict[str, list[str]] = {}
    for role in CONFIGURABLE_ROLES:
        roles[role] = permissions_for_role(db, role)
    return {
        "catalog": catalog_for_api(),
        "configurableRoles": list(CONFIGURABLE_ROLES),
        "lockedRole": LOCKED_ROLE,
        "roles": roles,
    }


def set_role_permissions(db: Session, role: str, permissions: list[str]) -> list[str]:
    if role not in CONFIGURABLE_ROLES:
        raise ValueError("role_not_configurable")
    normalized = normalize_permission_list(permissions)
    ensure_role_permission_rows(db)
    row = db.get(RolePermission, role)
    assert row is not None
    row.permissions = normalized
    row.updatedAt = utcnow()
    db.flush()
    return normalized
