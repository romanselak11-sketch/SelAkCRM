from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from selakcrm.ids import new_cuid
from selakcrm.models import AuditEvent
from selakcrm.time_utils import utcnow


def audit_log(
    db: Session,
    *,
    user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    payload: dict[str, Any] | list[Any] | None = None,
) -> None:
    ev = AuditEvent(
        id=new_cuid(),
        userId=user_id,
        action=action,
        entityType=entity_type,
        entityId=entity_id,
        payload=payload,
        createdAt=utcnow(),
    )
    db.add(ev)


def purge_audit_older_than_one_year(db: Session) -> None:
    cutoff = utcnow() - timedelta(days=365)
    db.query(AuditEvent).filter(AuditEvent.createdAt < cutoff).delete(synchronize_session=False)
    db.commit()
