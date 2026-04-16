from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, get_current_user
from selakcrm.schemas_base import StrictBody
from selakcrm.domain.policy_dates import calendar_days_until_end
from selakcrm.models import Client, InsuranceCompany, InsuranceProduct, Policy, RenewalTask
from selakcrm.routes.policies_routes import CreatePolicyIn, create_policy_from_home
from selakcrm.serializers import _iso, client_row, company_row, policy_full, product_row, renewal_task_hours_minutes
from selakcrm.services.audit_log import audit_log
from selakcrm.services.renewal_sync import RenewalSyncService
from selakcrm.time_utils import utcnow

router = APIRouter(prefix="/home", tags=["home"])

RENEWAL_INCLUDE = (
    joinedload(RenewalTask.policy).joinedload(Policy.client),
    joinedload(RenewalTask.policy).joinedload(Policy.company),
    joinedload(RenewalTask.policy).joinedload(Policy.product),
)
ALLOWED_TASK_LIMITS = {10, 25, 50}


def _page_limit(page_raw: str | None, limit_raw: str | None) -> tuple[int, int]:
    try:
        lim = int(limit_raw or "25")
    except ValueError:
        lim = 25
    if lim not in ALLOWED_TASK_LIMITS:
        lim = 25
    try:
        page = int(page_raw or "1")
    except ValueError:
        page = 1
    if page < 1:
        page = 1
    return page, lim


def _map_renewal_row(t: RenewalTask, today: datetime) -> dict:
    p = t.policy
    days_left = calendar_days_until_end(p.endDate, today)
    if days_left >= 1:
        display = {"kind": "days", "value": days_left}
    else:
        display = {"kind": "hm", "value": renewal_task_hours_minutes(p.endDate, today)}
    return {
        "taskId": t.id,
        "taskNumber": t.taskNumber,
        "policyId": p.id,
        "createdAt": t.createdAt.isoformat() + "Z",
        "statusChangedAt": t.statusChangedAt.isoformat() + "Z",
        "status": t.status,
        "declineReason": t.declineReason,
        "display": display,
        "client": {
            "id": p.client.id,
            "lastName": p.client.lastName,
            "firstName": p.client.firstName,
            "middleName": p.client.middleName,
            "phone": p.client.phone,
            "documentsUrl": p.client.documentsUrl,
        },
        "policy": {
            "number": p.number,
            "endDate": _iso(p.endDate),
            "companyName": p.company.name,
            "productName": p.product.name,
            "insuranceSumS": p.insuranceSumS,
        },
    }


@router.get("/policy-form/clients")
def policy_form_clients(
    _: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.query(Client)
        .options(joinedload(Client.additionalPhones))
        .filter(Client.deletedAt.is_(None))
        .order_by(Client.lastName, Client.firstName)
        .all()
    )
    return [client_row(c) for c in rows]


@router.get("/policy-form/companies")
def policy_form_companies(
    _: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = (
        db.query(InsuranceCompany)
        .options(joinedload(InsuranceCompany.products))
        .filter(InsuranceCompany.deletedAt.is_(None))
        .order_by(InsuranceCompany.name)
        .all()
    )
    return [company_row(ic) for ic in rows]


@router.get("/policy-form/companies/{company_id}/products")
def policy_form_products(
    company_id: str,
    _: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> list[dict]:
    items = (
        db.query(InsuranceProduct)
        .filter(InsuranceProduct.companyId == company_id, InsuranceProduct.deletedAt.is_(None))
        .order_by(InsuranceProduct.name)
        .all()
    )
    return [product_row(p) for p in items]


@router.get("/renewal-tasks")
def renewal_tasks(
    _: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> list[dict]:
    RenewalSyncService(db).sync_cached()
    tasks = (
        db.query(RenewalTask)
        .options(*RENEWAL_INCLUDE)
        .join(Policy)
        .filter(Policy.deletedAt.is_(None), RenewalTask.status.in_(("IN_PROGRESS", "AWAITING_ACTION")))
        .order_by(RenewalTask.createdAt)
        .all()
    )
    today = utcnow()
    out = []
    for t in tasks:
        row = _map_renewal_row(t, today)
        out.append(
            {
                "taskId": row["taskId"],
                "policyId": row["policyId"],
                "status": row["status"],
                "display": row["display"],
                "client": row["client"],
                "policy": row["policy"],
                "declineReason": row["declineReason"],
            }
        )
    return out


@router.get("/tasks")
def tasks_registry(
    _: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
    page: str | None = None,
    limit: str | None = None,
) -> dict:
    RenewalSyncService(db).sync_cached()
    p, lim = _page_limit(page, limit)
    skip = (p - 1) * lim
    base_q = (
        db.query(RenewalTask)
        .join(Policy)
        .filter(Policy.deletedAt.is_(None))
    )
    total = base_q.count()
    tasks = (
        base_q
        .options(*RENEWAL_INCLUDE)
        .order_by(RenewalTask.taskNumber.desc())
        .offset(skip)
        .limit(lim)
        .all()
    )
    today = utcnow()
    return {"items": [_map_renewal_row(t, today) for t in tasks], "total": total, "page": p, "limit": lim}


@router.get("/notifications")
def notifications(
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> list[dict]:
    from selakcrm.models import HomeNotification

    rows = (
        db.query(HomeNotification)
        .filter(HomeNotification.userId == user.sub, HomeNotification.readAt.is_(None))
        .order_by(HomeNotification.createdAt.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "userId": n.userId,
            "type": n.type,
            "dedupeKey": n.dedupeKey,
            "message": n.message,
            "readAt": n.readAt.isoformat() + "Z" if n.readAt else None,
            "createdAt": n.createdAt.isoformat() + "Z",
        }
        for n in rows
    ]


@router.post("/notifications/{notif_id}/ack")
def ack_notification(
    notif_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    from selakcrm.models import HomeNotification

    n = (
        db.query(HomeNotification)
        .filter(HomeNotification.id == notif_id, HomeNotification.userId == user.sub)
        .first()
    )
    if not n:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    n.readAt = utcnow()
    return {"ok": True}


class PostponeIn(StrictBody):
    mode: str = Field(pattern="^(simple|feedback)$")
    until: str = Field(min_length=10)


@router.post("/renewal-tasks/{task_id}/postpone")
def postpone_task(
    task_id: str,
    body: PostponeIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    t = db.query(RenewalTask).options(joinedload(RenewalTask.policy)).filter(RenewalTask.id == task_id).first()
    if not t:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    if t.status not in ("IN_PROGRESS", "AWAITING_ACTION"):
        raise HTTPException(400, detail={"statusCode": 400, "message": "Задача недоступна для отсрочки", "error": "Bad Request"})
    until = datetime.fromisoformat(body.until.replace("Z", "+00:00"))
    if until.tzinfo:
        until = until.replace(tzinfo=None)  # noqa: DTZ007
    if until <= utcnow():
        raise HTTPException(400, detail={"statusCode": 400, "message": "Укажите дату и время в будущем", "error": "Bad Request"})
    next_status = "AWAITING_FEEDBACK" if body.mode == "feedback" else "POSTPONED"
    now = utcnow()
    t.status = next_status
    t.snoozedUntil = until
    t.statusChangedAt = now
    audit_log(
        db,
        user_id=user.sub,
        action="RENEWAL_POSTPONED",
        entity_type="RenewalTask",
        entity_id=task_id,
        payload={"policyId": t.policyId, "mode": body.mode, "until": body.until},
    )
    return {"ok": True}


class DeclineIn(StrictBody):
    reason: str = Field(min_length=1, max_length=1000)


@router.post("/renewal-tasks/{task_id}/decline")
def decline_task(
    task_id: str,
    body: DeclineIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    t = db.query(RenewalTask).options(joinedload(RenewalTask.policy)).filter(RenewalTask.id == task_id).first()
    if not t:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    if t.status not in ("IN_PROGRESS", "AWAITING_ACTION"):
        raise HTTPException(400, detail={"statusCode": 400, "message": "Задача уже закрыта", "error": "Bad Request"})
    now = utcnow()
    t.status = "CLIENT_DECLINED"
    t.declineReason = body.reason
    t.snoozedUntil = None
    t.statusChangedAt = now
    audit_log(
        db,
        user_id=user.sub,
        action="RENEWAL_DECLINED",
        entity_type="RenewalTask",
        entity_id=task_id,
        payload={"policyId": t.policyId, "reason": body.reason},
    )
    return {"ok": True}


@router.post("/renewal-tasks/{task_id}/renew")
def renew_task(
    task_id: str,
    body: CreatePolicyIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    t = db.query(RenewalTask).options(joinedload(RenewalTask.policy)).filter(RenewalTask.id == task_id).first()
    if not t or t.status not in ("IN_PROGRESS", "AWAITING_ACTION"):
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    if body.clientId != t.policy.clientId:
        raise HTTPException(
            400,
            detail={"statusCode": 400, "message": "Клиент должен совпадать с полисом в задаче", "error": "Bad Request"},
        )
    new_p = create_policy_from_home(db, body, user.sub)
    now = utcnow()
    t.status = "RENEWED"
    t.snoozedUntil = None
    t.statusChangedAt = now
    audit_log(
        db,
        user_id=user.sub,
        action="RENEWAL_RENEWED",
        entity_type="RenewalTask",
        entity_id=task_id,
        payload={"oldPolicyId": t.policyId, "newPolicyId": new_p.id},
    )
    RenewalSyncService(db).sync_after_policy_change()
    new_p = (
        db.query(Policy)
        .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.id == new_p.id)
        .one()
    )
    return policy_full(new_p)


@router.post("/policies")
def home_create_policy(
    body: CreatePolicyIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    new_p = create_policy_from_home(db, body, user.sub)
    RenewalSyncService(db).sync_after_policy_change()
    new_p = (
        db.query(Policy)
        .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.id == new_p.id)
        .one()
    )
    return policy_full(new_p)
