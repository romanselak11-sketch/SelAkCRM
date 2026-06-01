"""renewal task renewed policy id

Revision ID: b8c1e2f04a21
Revises: a4d9f2c0be11
Create Date: 2026-05-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8c1e2f04a21"
down_revision: Union[str, Sequence[str], None] = "a4d9f2c0be11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    # SQLite не поддерживает ALTER CONSTRAINT — только batch mode (copy-and-move).
    if _has_column("RenewalTask", "renewedPolicyId"):
        return
    with op.batch_alter_table("RenewalTask", schema=None) as batch_op:
        batch_op.add_column(sa.Column("renewedPolicyId", sa.String(), nullable=True))
        batch_op.create_foreign_key(
            "RenewalTask_renewedPolicyId_fkey",
            "Policy",
            ["renewedPolicyId"],
            ["id"],
        )


def downgrade() -> None:
    if not _has_column("RenewalTask", "renewedPolicyId"):
        return
    with op.batch_alter_table("RenewalTask", schema=None) as batch_op:
        batch_op.drop_constraint("RenewalTask_renewedPolicyId_fkey", type_="foreignkey")
        batch_op.drop_column("renewedPolicyId")
