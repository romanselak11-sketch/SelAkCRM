from __future__ import annotations

from sqlalchemy.orm import Session

from selakcrm.ids import new_cuid
from selakcrm.models import RenewalTaskComment
from selakcrm.time_utils import utcnow


def add_renewal_task_comment(
    db: Session,
    *,
    task_id: str,
    kind: str,
    text: str,
) -> RenewalTaskComment:
    row = RenewalTaskComment(
        id=new_cuid(),
        taskId=task_id,
        kind=kind,
        text=text.strip(),
        createdAt=utcnow(),
    )
    db.add(row)
    return row
