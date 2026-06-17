from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload, selectinload

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, get_current_user
from selakcrm.schemas_base import StrictBody
from selakcrm.domain.renewal_task_order import sort_renewal_tasks_by_policy_date
from selakcrm.models import Client, InsuranceCompany, InsuranceProduct, Policy, RenewalTask
from selakcrm.routes.policies_routes import CreatePolicyIn, create_policy_from_home
from selakcrm.routes.clients_routes import CreateClientIn, _validate_documents_url
from selakcrm.serializers import _iso, client_row, company_row, policy_full, product_row, renewal_task_row_display
from selakcrm.services.audit_log import audit_log
from selakcrm.services.client_create import create_client_record
from selakcrm.domain.search import client_search_where_clause, parse_search_tokens, policy_search_where_clause
from selakcrm.services.manual_renewal_task import create_manual_renewal_task
from selakcrm.services.renewal_sync import RenewalSyncService
from selakcrm.services.renewal_task_comment import add_renewal_task_comment
from selakcrm.services.renewal_task_comment_map import (
    latest_renewal_task_comment,
    renewal_task_comment_history,
)
from selakcrm.time_utils import utcnow

router = APIRouter(prefix="/home", tags=["home"])

RENEWAL_INCLUDE = (
    joinedload(RenewalTask.policy).joinedload(Policy.client),
    joinedload(RenewalTask.policy).joinedload(Policy.company),
    joinedload(RenewalTask.policy).joinedload(Policy.product),
    joinedload(RenewalTask.renewedPolicy).joinedload(Policy.company),
    joinedload(RenewalTask.renewedPolicy).joinedload(Policy.product),
    selectinload(RenewalTask.comments),
)
ACTIONABLE_RENEWAL_STATUSES = ("IN_PROGRESS", "AWAITING_ACTION", "POSTPONED", "AWAITING_FEEDBACK")
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


def _policy_summary(p: Policy) -> dict:
    return {
        "id": p.id,
        "number": p.number,
        "endDate": _iso(p.endDate),
        "issueDate": _iso(p.issueDate) if p.issueDate else None,
        "companyName": p.company.name,
        "productName": p.product.name,
        "insuredObject": p.insuredObject,
        "insuranceSumS": p.insuranceSumS,
        "premiumRubles": p.premiumRubles,
    }


def _map_renewal_row(t: RenewalTask, today: datetime) -> dict:
    p = t.policy
    display = renewal_task_row_display(t, today)
    renewed_policy = None
    if t.status == "RENEWED" and t.renewedPolicy is not None:
        renewed_policy = _policy_summary(t.renewedPolicy)
    return {
        "taskId": t.id,
        "taskNumber": t.taskNumber,
        "policyId": p.id,
        "createdAt": t.createdAt.isoformat() + "Z",
        "statusChangedAt": t.statusChangedAt.isoformat() + "Z",
        "status": t.status,
        "declineReason": t.declineReason,
        "feedbackComment": latest_renewal_task_comment(t, "AWAITING_FEEDBACK") or t.feedbackComment,
        "postponeComment": latest_renewal_task_comment(t, "POSTPONE") or t.postponeComment,
        "commentHistory": renewal_task_comment_history(t),
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
            "insuredObject": p.insuredObject,
            "insuranceSumS": p.insuranceSumS,
        },
        "renewedPolicy": renewed_policy,
        "renewedPolicyId": t.renewedPolicyId,
    }


def _require_policy_form_client_create(user: JwtUser) -> None:
    if user.role not in ("SUPER_ADMIN", "SUPER_MANAGER", "MANAGER"):
        raise HTTPException(403, detail={"statusCode": 403, "message": "Forbidden", "error": "Forbidden"})


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


@router.post("/policy-form/clients")
def policy_form_create_client(
    body: CreateClientIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    """Создание клиента из формы полиса (менеджер и супер-менеджер)."""
    _require_policy_form_client_create(user)
    _validate_documents_url(body.documentsUrl)
    c = create_client_record(
        db,
        user_id=user.sub,
        last_name=body.lastName,
        first_name=body.firstName,
        middle_name=body.middleName,
        phone=body.phone,
        additional_phones=body.additionalPhones,
        email=body.email,
        documents_url=body.documentsUrl,
    )
    return client_row(c)


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


@router.get("/policy-form/policies")
def policy_form_policies(
    _: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
    q: str | None = None,
    limit: str | None = None,
) -> list[dict]:
    """Поиск полисов для привязки ручной задачи продления."""
    try:
        lim = int(limit or "20")
    except ValueError:
        lim = 20
    lim = max(1, min(lim, 50))
    tokens = parse_search_tokens(q)
    if not tokens:
        rows = (
            db.query(Policy)
            .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
            .filter(Policy.deletedAt.is_(None))
            .order_by(Policy.createdAt.desc())
            .limit(lim)
            .all()
        )
    else:
        cond_sql, params = policy_search_where_clause(tokens)
        ids_sql = text(
            f'SELECT p.id FROM "Policy" p INNER JOIN "Client" cl ON cl.id = p."clientId" '
            f'WHERE p."deletedAt" IS NULL AND ({cond_sql}) ORDER BY p."createdAt" DESC LIMIT :lim'
        )
        ids = [r[0] for r in db.execute(ids_sql, {**params, "lim": lim}).fetchall()]
        if not ids:
            return []
        rows_unordered = (
            db.query(Policy)
            .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
            .filter(Policy.id.in_(ids))
            .all()
        )
        by_id = {p.id: p for p in rows_unordered}
        rows = [by_id[i] for i in ids if i in by_id]
    return [
        {
            "id": p.id,
            "number": p.number,
            "endDate": _iso(p.endDate),
            "clientLabel": f"{p.client.lastName} {p.client.firstName}",
            "companyName": p.company.name,
            "productName": p.product.name,
        }
        for p in rows
    ]


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
        .join(Policy, RenewalTask.policyId == Policy.id)
        .filter(Policy.deletedAt.is_(None), RenewalTask.status.in_(ACTIONABLE_RENEWAL_STATUSES))
        .all()
    )
    today = utcnow()
    tasks = sort_renewal_tasks_by_policy_date(tasks, today)
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
                "feedbackComment": row["feedbackComment"],
                "postponeComment": row["postponeComment"],
                "commentHistory": row["commentHistory"],
                "renewedPolicy": row["renewedPolicy"],
            }
        )
    return out


class CreateManualRenewalTaskIn(StrictBody):
    policyId: str | None = None
    clientId: str | None = None
    companyId: str | None = None
    productId: str | None = None
    number: str | None = Field(default=None, min_length=1)
    insuredObject: str | None = Field(default=None, min_length=1)
    category: str | None = None
    source: str | None = None
    insuranceSumS: str | None = None
    premiumPercent: str | None = None
    premiumRubles: str | None = None
    issueDate: str | None = Field(default=None, min_length=10)
    endDate: str | None = Field(default=None, min_length=10)

    @model_validator(mode="after")
    def validate_mode(self) -> CreateManualRenewalTaskIn:
        if self.policyId:
            return self
        required = (
            "clientId",
            "companyId",
            "productId",
            "number",
            "insuredObject",
            "endDate",
        )
        missing = [f for f in required if not getattr(self, f)]
        if missing:
            raise ValueError("Для нового полиса заполните клиента, компанию, продукт, номер, объект и дату окончания")
        return self


@router.post("/tasks")
def create_manual_task(
    body: CreateManualRenewalTaskIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_policy_form_client_create(user)
    policy_dto = None
    if not body.policyId:
        policy_dto = CreatePolicyIn(
            clientId=body.clientId,  # type: ignore[arg-type]
            companyId=body.companyId,  # type: ignore[arg-type]
            productId=body.productId,  # type: ignore[arg-type]
            number=body.number,  # type: ignore[arg-type]
            insuredObject=body.insuredObject,  # type: ignore[arg-type]
            category=body.category,
            source=body.source,
            insuranceSumS=body.insuranceSumS,
            premiumPercent=body.premiumPercent,
            premiumRubles=body.premiumRubles,
            issueDate=body.issueDate,
            endDate=body.endDate,  # type: ignore[arg-type]
        )
    task = create_manual_renewal_task(
        db,
        actor_id=user.sub,
        policy_id=body.policyId,
        policy_dto=policy_dto,
    )
    return _map_renewal_row(task, utcnow())


@router.get("/tasks")
def tasks_registry(
    _: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
    page: str | None = None,
    limit: str | None = None,
    q: str | None = None,
) -> dict:
    RenewalSyncService(db).sync_cached()
    p, lim = _page_limit(page, limit)
    skip = (p - 1) * lim
    base_q = (
        db.query(RenewalTask)
        .join(Policy, RenewalTask.policyId == Policy.id)
        .filter(Policy.deletedAt.is_(None))
    )
    tokens = parse_search_tokens(q)
    if tokens:
        cond_sql, params = client_search_where_clause(tokens)
        client_ids_sql = text(
            f'SELECT c.id FROM "Client" c WHERE c."deletedAt" IS NULL AND ({cond_sql})'
        )
        client_ids = [r[0] for r in db.execute(client_ids_sql, params).fetchall()]
        if not client_ids:
            return {"items": [], "total": 0, "page": p, "limit": lim}
        base_q = base_q.filter(Policy.clientId.in_(client_ids))
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
    comment: str | None = Field(default=None, max_length=1000)


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
    if t.status not in ACTIONABLE_RENEWAL_STATUSES:
        raise HTTPException(400, detail={"statusCode": 400, "message": "Задача недоступна для отсрочки", "error": "Bad Request"})
    until = datetime.fromisoformat(body.until.replace("Z", "+00:00"))
    if until.tzinfo:
        until = until.replace(tzinfo=None)  # noqa: DTZ007
    if until <= utcnow():
        raise HTTPException(400, detail={"statusCode": 400, "message": "Укажите дату и время в будущем", "error": "Bad Request"})
    comment = (body.comment or "").strip()
    if not comment:
        msg = (
            "Укажите комментарий: что ждём от клиента (1–1000 символов)"
            if body.mode == "feedback"
            else "Укажите комментарий к отсрочке (1–1000 символов)"
        )
        raise HTTPException(
            400,
            detail={"statusCode": 400, "message": msg, "error": "Bad Request"},
        )
    next_status = "AWAITING_FEEDBACK" if body.mode == "feedback" else "POSTPONED"
    now = utcnow()
    t.status = next_status
    t.snoozedUntil = until
    comment_kind = "AWAITING_FEEDBACK" if body.mode == "feedback" else "POSTPONE"
    add_renewal_task_comment(db, task_id=task_id, kind=comment_kind, text=comment)
    if body.mode == "feedback":
        t.feedbackComment = comment
        t.postponeComment = None
    else:
        t.postponeComment = comment
        t.feedbackComment = None
    t.statusChangedAt = now
    audit_log(
        db,
        user_id=user.sub,
        action="RENEWAL_POSTPONED",
        entity_type="RenewalTask",
        entity_id=task_id,
        payload={"policyId": t.policyId, "mode": body.mode, "until": body.until, "comment": comment or None},
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
    if t.status not in ACTIONABLE_RENEWAL_STATUSES:
        raise HTTPException(400, detail={"statusCode": 400, "message": "Задача уже закрыта", "error": "Bad Request"})
    now = utcnow()
    t.status = "CLIENT_DECLINED"
    t.declineReason = body.reason
    add_renewal_task_comment(db, task_id=task_id, kind="DECLINE", text=body.reason)
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
    if not t or t.status not in ACTIONABLE_RENEWAL_STATUSES:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    new_p = create_policy_from_home(db, body, user.sub)
    now = utcnow()
    t.status = "RENEWED"
    t.renewedPolicyId = new_p.id
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
