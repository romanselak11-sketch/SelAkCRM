"""renewal task comment history

Revision ID: e5a1c8d92f33
Revises: d4e2b07f3a15
Create Date: 2026-06-04 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5a1c8d92f33"
down_revision: Union[str, Sequence[str], None] = "d4e2b07f3a15"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(name: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return name in insp.get_table_names()


def upgrade() -> None:
    if not _has_table("RenewalTaskComment"):
        op.create_table(
            "RenewalTaskComment",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("taskId", sa.String(), nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("text", sa.String(), nullable=False),
            sa.Column("createdAt", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["taskId"], ["RenewalTask.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "RenewalTaskComment_taskId_createdAt_idx",
            "RenewalTaskComment",
            ["taskId", "createdAt"],
            unique=False,
        )

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            'SELECT id, "postponeComment", "feedbackComment", "declineReason" FROM "RenewalTask"'
        )
    ).fetchall()
    for task_id, postpone, feedback, decline in rows:
        existing = bind.execute(
            sa.text('SELECT 1 FROM "RenewalTaskComment" WHERE "taskId" = :tid LIMIT 1'),
            {"tid": task_id},
        ).first()
        if existing:
            continue
        for kind, text in (
            ("POSTPONE", postpone),
            ("AWAITING_FEEDBACK", feedback),
            ("DECLINE", decline),
        ):
            if text and str(text).strip():
                bind.execute(
                    sa.text(
                        'INSERT INTO "RenewalTaskComment" (id, "taskId", kind, text, "createdAt") '
                        "VALUES (:id, :taskId, :kind, :text, datetime('now'))"
                    ),
                    {
                        "id": f"migrate_{task_id}_{kind}",
                        "taskId": task_id,
                        "kind": kind,
                        "text": str(text).strip(),
                    },
                )


def downgrade() -> None:
    if _has_table("RenewalTaskComment"):
        op.drop_index("RenewalTaskComment_taskId_createdAt_idx", table_name="RenewalTaskComment")
        op.drop_table("RenewalTaskComment")
