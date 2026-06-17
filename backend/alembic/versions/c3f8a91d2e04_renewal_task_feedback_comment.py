"""renewal task feedback comment

Revision ID: c3f8a91d2e04
Revises: b8c1e2f04a21
Create Date: 2026-06-04 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c3f8a91d2e04"
down_revision: Union[str, Sequence[str], None] = "b8c1e2f04a21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c["name"] == column for c in insp.get_columns(table))


def upgrade() -> None:
    if _has_column("RenewalTask", "feedbackComment"):
        return
    with op.batch_alter_table("RenewalTask", schema=None) as batch_op:
        batch_op.add_column(sa.Column("feedbackComment", sa.String(), nullable=True))


def downgrade() -> None:
    if not _has_column("RenewalTask", "feedbackComment"):
        return
    with op.batch_alter_table("RenewalTask", schema=None) as batch_op:
        batch_op.drop_column("feedbackComment")
