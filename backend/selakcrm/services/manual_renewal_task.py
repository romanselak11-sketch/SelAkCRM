from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from selakcrm.ids import new_cuid
from selakcrm.models import Policy, RenewalTask
from selakcrm.routes.policies_routes import CreatePolicyIn, create_policy_from_home
from selakcrm.services.audit_log import audit_log
from selakcrm.services.renewal_sync import OPEN_RENEWAL_STATUSES
from selakcrm.time_utils import utcnow


def _open_task_for_policy(db: Session, policy_id: str) -> RenewalTask | None:
    return (
        db.query(RenewalTask)
        .filter(
            RenewalTask.policyId == policy_id,
            RenewalTask.status.in_(OPEN_RENEWAL_STATUSES),
        )
        .first()
    )


def create_manual_renewal_task(
    db: Session,
    *,
    actor_id: str,
    policy_id: str | None = None,
    policy_dto: CreatePolicyIn | None = None,
) -> RenewalTask:
    if policy_id:
        p = (
            db.query(Policy)
            .options(
                joinedload(Policy.client),
                joinedload(Policy.company),
                joinedload(Policy.product),
            )
            .filter(Policy.id == policy_id, Policy.deletedAt.is_(None))
            .first()
        )
        if not p:
            raise HTTPException(
                404,
                detail={"statusCode": 404, "message": "Полис не найден", "error": "Not Found"},
            )
        if p.client.deletedAt or p.company.deletedAt or p.product.deletedAt:
            raise HTTPException(
                422,
                detail={
                    "statusCode": 422,
                    "message": "Связанные сущности полиса недоступны",
                    "error": "Unprocessable Entity",
                },
            )
    else:
        if policy_dto is None:
            raise HTTPException(
                400,
                detail={"statusCode": 400, "message": "Укажите полис или данные нового полиса", "error": "Bad Request"},
            )
        p = create_policy_from_home(db, policy_dto, actor_id)

    existing = _open_task_for_policy(db, p.id)
    if existing:
        raise HTTPException(
            409,
            detail={
                "statusCode": 409,
                "message": "У полиса уже есть активная задача продления",
                "error": "Conflict",
            },
        )

    max_num = db.query(func.max(RenewalTask.taskNumber)).scalar()
    task_number = (max_num or 0) + 1
    now = utcnow()
    task = RenewalTask(
        id=new_cuid(),
        taskNumber=task_number,
        policyId=p.id,
        status="IN_PROGRESS",
        statusChangedAt=now,
        createdAt=now,
        updatedAt=now,
    )
    db.add(task)
    db.flush()
    audit_log(
        db,
        user_id=actor_id,
        action="RENEWAL_TASK_MANUAL_CREATE",
        entity_type="RenewalTask",
        entity_id=task.id,
        payload={"policyId": p.id, "policyIdProvided": policy_id is not None},
    )
    return (
        db.query(RenewalTask)
        .options(
            joinedload(RenewalTask.policy).joinedload(Policy.client),
            joinedload(RenewalTask.policy).joinedload(Policy.company),
            joinedload(RenewalTask.policy).joinedload(Policy.product),
            joinedload(RenewalTask.renewedPolicy).joinedload(Policy.company),
            joinedload(RenewalTask.renewedPolicy).joinedload(Policy.product),
        )
        .filter(RenewalTask.id == task.id)
        .one()
    )
