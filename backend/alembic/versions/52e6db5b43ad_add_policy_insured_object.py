"""add policy insured object

Revision ID: 52e6db5b43ad
Revises: 6dab3880da05
Create Date: 2026-05-08 15:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "52e6db5b43ad"
down_revision: Union[str, Sequence[str], None] = "6dab3880da05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("Policy", sa.Column("insuredObject", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("Policy", "insuredObject")
