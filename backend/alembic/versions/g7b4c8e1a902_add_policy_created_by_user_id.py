"""add policy created_by_user_id

Revision ID: g7b4c8e1a902
Revises: f1a2b3c4d5e6
Create Date: 2026-08-06 22:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g7b4c8e1a902"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("Policy") as batch_op:
        batch_op.add_column(sa.Column("createdByUserId", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            "Policy_createdByUserId_fkey",
            "User",
            ["createdByUserId"],
            ["id"],
        )
        batch_op.create_index("Policy_createdByUserId_idx", ["createdByUserId"])

    # Backfill from earliest POLICY_CREATE audit event per policy.
    op.execute(
        """
        UPDATE "Policy"
        SET "createdByUserId" = (
            SELECT ae."userId"
            FROM "AuditEvent" ae
            WHERE ae."entityType" = 'Policy'
              AND ae."action" = 'POLICY_CREATE'
              AND ae."entityId" = "Policy".id
              AND ae."userId" IS NOT NULL
            ORDER BY ae."createdAt" ASC
            LIMIT 1
        )
        WHERE "createdByUserId" IS NULL
        """
    )


def downgrade() -> None:
    with op.batch_alter_table("Policy") as batch_op:
        batch_op.drop_index("Policy_createdByUserId_idx")
        batch_op.drop_constraint("Policy_createdByUserId_fkey", type_="foreignkey")
        batch_op.drop_column("createdByUserId")
