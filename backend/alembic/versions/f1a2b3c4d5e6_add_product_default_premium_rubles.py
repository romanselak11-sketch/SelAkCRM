"""add product default premium rubles

Revision ID: f1a2b3c4d5e6
Revises: e5a1c8d92f33
Create Date: 2026-08-06 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e5a1c8d92f33"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "InsuranceProduct",
        sa.Column("defaultPremiumRubles", sa.String(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("InsuranceProduct", "defaultPremiumRubles")
