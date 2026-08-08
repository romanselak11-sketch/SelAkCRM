from datetime import datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, assert_permission, get_current_user
from selakcrm.schemas_base import StrictBody
from selakcrm.domain.policy_dates import calendar_date_from_ymd, same_calendar_day
from selakcrm.domain.policy_income import assert_valid_policy_combination, compute_agent_income_d
from selakcrm.domain.search import parse_search_tokens, policy_search_where_clause
from selakcrm.ids import new_cuid
from selakcrm.models import Client, InsuranceCompany, InsuranceProduct, Policy
from selakcrm.serializers import policy_full
from selakcrm.services.audit_log import audit_log
from selakcrm.services.renewal_sync import RenewalSyncService
from selakcrm.time_utils import utcnow

router = APIRouter(prefix="/policies", tags=["policies"])

ALLOWED_LIMITS = {10, 25, 50}


def _page_limit(page_raw: str | None, limit_raw: str | None) -> tuple[int, int]:
    try:
        lim = int(limit_raw or "25")
    except ValueError:
        lim = 25
    if lim not in ALLOWED_LIMITS:
        lim = 25
    try:
        page = int(page_raw or "1")
    except ValueError:
        page = 1
    if page < 1:
        page = 1
    return page, lim


def _require_policies_read(db: Session, user: JwtUser) -> None:
    assert_permission(db, user, "nav.policies")


def _require_policies_create(db: Session, user: JwtUser) -> None:
    assert_permission(db, user, "policies.create")


def _require_policies_edit(db: Session, user: JwtUser) -> None:
    assert_permission(db, user, "policies.edit")


def _assert_premium_pct(pct: str | None) -> None:
    if pct is None or pct == "":
        return
    d = Decimal(pct)
    if d < 0 or d > 100:
        raise HTTPException(400, detail={"statusCode": 400, "message": "P% должен быть от 0 до 100", "error": "Bad Request"})


def _assert_refs_active(db: Session, client_id: str, company_id: str, product_id: str) -> None:
    client = db.get(Client, client_id)
    company = db.get(InsuranceCompany, company_id)
    product = db.get(InsuranceProduct, product_id)
    if not client or client.deletedAt is not None:
        raise HTTPException(
            422,
            detail={"statusCode": 422, "message": "Клиент недоступен или в архиве", "error": "Unprocessable Entity"},
        )
    if not company or company.deletedAt is not None:
        raise HTTPException(
            422,
            detail={"statusCode": 422, "message": "Компания недоступна или в архиве", "error": "Unprocessable Entity"},
        )
    if not product or product.deletedAt is not None or product.companyId != company_id:
        raise HTTPException(
            422,
            detail={"statusCode": 422, "message": "Продукт недоступен или в архиве", "error": "Unprocessable Entity"},
        )


class CreatePolicyIn(StrictBody):
    clientId: str
    companyId: str
    productId: str
    number: str = Field(min_length=1)
    insuredObject: str = Field(min_length=1)
    category: str | None = None
    source: str | None = None
    insuranceSumS: str | None = None
    premiumPercent: str | None = None
    premiumRubles: str | None = None
    issueDate: str | None = Field(default=None, min_length=10)
    endDate: str = Field(min_length=10)


class UpdatePolicyIn(StrictBody):
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


def _build_income_input(
    insurance_sum_s: str | None,
    premium_percent: str | None,
    premium_rubles: str | None,
) -> tuple[str | None, str | None, str]:
    return insurance_sum_s, premium_percent, premium_rubles if premium_rubles is not None else "0"


def _create_policy_entity(
    db: Session,
    dto: CreatePolicyIn,
    actor_id: str,
    *,
    from_home: bool,
) -> Policy:
    _assert_refs_active(db, dto.clientId, dto.companyId, dto.productId)
    _assert_premium_pct(dto.premiumPercent)
    ins_s, pct, rub = _build_income_input(dto.insuranceSumS, dto.premiumPercent, dto.premiumRubles)
    try:
        assert_valid_policy_combination(ins_s, pct, rub)
    except ValueError as e:
        raise HTTPException(400, detail={"statusCode": 400, "message": str(e), "error": "Bad Request"})
    agent_d = compute_agent_income_d(ins_s, pct, rub)
    end_date = calendar_date_from_ymd(dto.endDate)
    now = utcnow()
    issue_date = calendar_date_from_ymd(dto.issueDate) if dto.issueDate else now
    src = dto.source or "OFFICE"
    p = Policy(
        id=new_cuid(),
        clientId=dto.clientId,
        companyId=dto.companyId,
        productId=dto.productId,
        number=dto.number,
        insuredObject=dto.insuredObject,
        category=dto.category,
        source=src,
        insuranceSumS=ins_s if ins_s not in (None, "") else None,
        premiumPercent=pct if pct not in (None, "") else None,
        premiumRubles=rub or "0",
        agentIncomeD=str(agent_d.quantize(Decimal("0.01"))),
        issueDate=issue_date,
        startDate=end_date,
        endDate=end_date,
        termDays=1,
        createdByUserId=actor_id,
        createdAt=now,
        updatedAt=now,
    )
    db.add(p)
    db.flush()
    p = (
        db.query(Policy)
        .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.id == p.id)
        .one()
    )
    audit_log(
        db,
        user_id=actor_id,
        action="POLICY_CREATE",
        entity_type="Policy",
        entity_id=p.id,
        payload={"number": p.number, "companyId": p.companyId, **({"fromHome": True} if from_home else {})},
    )
    return p


@router.get("")
def list_policies(
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
    page: str | None = None,
    limit: str | None = None,
    q: str | None = None,
) -> dict:
    _require_policies_read(db, user)
    p, lim = _page_limit(page, limit)
    skip = (p - 1) * lim
    tokens = parse_search_tokens(q)
    if not tokens:
        total = db.query(Policy).filter(Policy.deletedAt.is_(None)).count()
        items = (
            db.query(Policy)
            .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
            .filter(Policy.deletedAt.is_(None))
            .order_by(Policy.createdAt.desc())
            .offset(skip)
            .limit(lim)
            .all()
        )
        return {"items": [policy_full(x) for x in items], "total": total, "page": p, "limit": lim}
    cond_sql, params = policy_search_where_clause(tokens)
    count_sql = text(
        f'SELECT COUNT(*) AS n FROM "Policy" p INNER JOIN "Client" cl ON cl.id = p."clientId" '
        f'WHERE p."deletedAt" IS NULL AND ({cond_sql})'
    )
    ids_sql = text(
        f'SELECT p.id FROM "Policy" p INNER JOIN "Client" cl ON cl.id = p."clientId" '
        f'WHERE p."deletedAt" IS NULL AND ({cond_sql}) ORDER BY p."createdAt" DESC LIMIT :lim OFFSET :skip'
    )
    total = int(db.execute(count_sql, params).scalar() or 0)
    rows = db.execute(ids_sql, {**params, "lim": lim, "skip": skip}).fetchall()
    ids = [r[0] for r in rows]
    if not ids:
        return {"items": [], "total": total, "page": p, "limit": lim}
    items_unordered = (
        db.query(Policy)
        .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.id.in_(ids))
        .all()
    )
    rank = {id_: i for i, id_ in enumerate(ids)}
    items = sorted(items_unordered, key=lambda x: rank[x.id])
    return {"items": [policy_full(x) for x in items], "total": total, "page": p, "limit": lim}


@router.get("/{policy_id}")
def get_policy(
    policy_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_policies_read(db, user)
    p = (
        db.query(Policy)
        .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.id == policy_id, Policy.deletedAt.is_(None))
        .first()
    )
    if not p:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    return policy_full(p)


@router.post("")
def create_policy_route(
    body: CreatePolicyIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_policies_create(db, user)
    p = _create_policy_entity(db, body, user.sub, from_home=False)
    RenewalSyncService(db).sync_after_policy_change()
    return policy_full(p)


@router.patch("/{policy_id}")
def update_policy_route(
    policy_id: str,
    body: UpdatePolicyIn,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_policies_edit(db, user)
    p = (
        db.query(Policy)
        .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.id == policy_id, Policy.deletedAt.is_(None))
        .first()
    )
    if not p:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    next_client = body.clientId if body.clientId is not None else p.clientId
    next_company = body.companyId if body.companyId is not None else p.companyId
    next_product = body.productId if body.productId is not None else p.productId
    _assert_refs_active(db, next_client, next_company, next_product)
    _assert_premium_pct(body.premiumPercent)

    merged_ins = body.insuranceSumS if body.insuranceSumS is not None else p.insuranceSumS
    merged_pct = body.premiumPercent if body.premiumPercent is not None else p.premiumPercent
    merged_rub = body.premiumRubles if body.premiumRubles is not None else p.premiumRubles
    if body.insuranceSumS is not None and body.insuranceSumS == "":
        merged_ins = None
    if body.premiumPercent is not None and body.premiumPercent == "":
        merged_pct = None
    if body.premiumRubles is not None and (body.premiumRubles == "" or body.premiumRubles is None):
        merged_rub = "0"

    try:
        assert_valid_policy_combination(merged_ins, merged_pct, merged_rub)
    except ValueError as e:
        raise HTTPException(400, detail={"statusCode": 400, "message": str(e), "error": "Bad Request"})
    agent_d = compute_agent_income_d(merged_ins, merged_pct, merged_rub)

    parsed_end = calendar_date_from_ymd(body.endDate) if body.endDate else None
    parsed_issue = calendar_date_from_ymd(body.issueDate) if body.issueDate else None
    end_changed = parsed_end is not None and not same_calendar_day(parsed_end, p.endDate)

    if body.clientId is not None:
        p.clientId = body.clientId
    if body.companyId is not None:
        p.companyId = body.companyId
    if body.productId is not None:
        p.productId = body.productId
    if body.number is not None:
        p.number = body.number
    if body.insuredObject is not None:
        p.insuredObject = body.insuredObject
    if body.category is not None:
        p.category = body.category
    if body.source is not None:
        p.source = body.source
    if body.insuranceSumS is not None:
        p.insuranceSumS = None if body.insuranceSumS == "" else body.insuranceSumS
    if body.premiumPercent is not None:
        p.premiumPercent = None if body.premiumPercent == "" else body.premiumPercent
    if body.premiumRubles is not None:
        p.premiumRubles = body.premiumRubles
    if parsed_issue is not None:
        p.issueDate = parsed_issue
    p.agentIncomeD = str(agent_d.quantize(Decimal("0.01")))
    if end_changed and parsed_end is not None:
        p.startDate = parsed_end
        p.endDate = parsed_end
        p.termDays = 1
    audit_log(
        db,
        user_id=user.sub,
        action="POLICY_UPDATE",
        entity_type="Policy",
        entity_id=policy_id,
        payload={"fields": [k for k, v in body.model_dump(exclude_unset=True).items()]},
    )
    db.flush()
    db.expire(p)
    p = (
        db.query(Policy)
        .options(joinedload(Policy.client), joinedload(Policy.company), joinedload(Policy.product))
        .filter(Policy.id == policy_id)
        .one()
    )
    RenewalSyncService(db).sync_after_policy_change()
    return policy_full(p)


@router.post("/{policy_id}/archive")
def archive_policy(
    policy_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_policies_edit(db, user)
    p = db.query(Policy).filter(Policy.id == policy_id, Policy.deletedAt.is_(None)).first()
    if not p:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    p.deletedAt = utcnow()
    audit_log(db, user_id=user.sub, action="POLICY_ARCHIVE", entity_type="Policy", entity_id=policy_id, payload={})
    RenewalSyncService(db).sync_after_policy_change()
    return {"ok": True}


@router.post("/{policy_id}/restore")
def restore_policy(
    policy_id: str,
    user: Annotated[JwtUser, Depends(get_current_user)],
    db: Session = Depends(get_db),
) -> dict:
    _require_policies_edit(db, user)
    p = db.get(Policy, policy_id)
    if not p:
        raise HTTPException(404, detail={"statusCode": 404, "message": "Not Found", "error": "Not Found"})
    p.deletedAt = None
    audit_log(db, user_id=user.sub, action="POLICY_RESTORE", entity_type="Policy", entity_id=policy_id, payload={})
    RenewalSyncService(db).sync_after_policy_change()
    return {"ok": True}


def create_policy_from_home(db: Session, body: CreatePolicyIn, actor_id: str) -> Policy:
    return _create_policy_entity(db, body, actor_id, from_home=True)
