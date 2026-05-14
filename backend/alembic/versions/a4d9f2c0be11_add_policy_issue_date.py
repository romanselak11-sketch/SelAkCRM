"""add policy issue date

Revision ID: a4d9f2c0be11
Revises: 52e6db5b43ad
Create Date: 2026-05-08 16:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a4d9f2c0be11"
down_revision: Union[str, Sequence[str], None] = "52e6db5b43ad"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("Policy", sa.Column("issueDate", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("Policy", "issueDate")
