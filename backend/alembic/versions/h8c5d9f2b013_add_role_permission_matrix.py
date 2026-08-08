"""add role permission matrix

Revision ID: h8c5d9f2b013
Revises: g7b4c8e1a902
Create Date: 2026-08-07 23:10:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "h8c5d9f2b013"
down_revision: Union[str, Sequence[str], None] = "g7b4c8e1a902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SUPER_MANAGER_PERMS = [
    "nav.home",
    "nav.tasks",
    "nav.companies",
    "nav.clients",
    "nav.policies",
    "nav.settings",
    "insurance.write",
    "clients.write",
    "clients.view_policies",
    "policies.create",
    "policies.edit",
    "tasks.create",
    "tasks.act",
    "tasks.edit_policy",
]

_MANAGER_PERMS = [
    "nav.home",
    "nav.tasks",
    "policies.create",
    "tasks.create",
    "tasks.act",
]


def upgrade() -> None:
    op.create_table(
        "RolePermission",
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("updatedAt", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("role"),
    )
    role_permission = sa.table(
        "RolePermission",
        sa.column("role", sa.String),
        sa.column("permissions", sa.JSON),
        sa.column("updatedAt", sa.DateTime),
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    op.bulk_insert(
        role_permission,
        [
            {
                "role": "SUPER_MANAGER",
                "permissions": _SUPER_MANAGER_PERMS,
                "updatedAt": now,
            },
            {
                "role": "MANAGER",
                "permissions": _MANAGER_PERMS,
                "updatedAt": now,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("RolePermission")
