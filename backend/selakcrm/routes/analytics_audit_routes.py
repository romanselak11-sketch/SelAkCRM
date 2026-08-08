from calendar import monthrange
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, require_permission
from selakcrm.models import AuditEvent
from selakcrm.services.analytics import (
    AnalyticsFilters,
    build_breakdowns,
    build_daily,
    build_renewals,
    build_summary,
)
from selakcrm.services.audit_description import describe_audit_event
from selakcrm.services.audit_log import purge_audit_older_than_one_year
from selakcrm.time_utils import utcnow

router_analytics = APIRouter(prefix="/analytics", tags=["analytics"])
router_audit = APIRouter(prefix="/audit", tags=["audit"])

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


def _analytics_access(
    user: Annotated[JwtUser, Depends(require_permission("nav.analytics"))],
) -> JwtUser:
    return user


def _audit_access(
    user: Annotated[JwtUser, Depends(require_permission("audit.read"))],
) -> JwtUser:
    return user


def _filters_from_query(
    date_from: str,
    date_to: str,
    user_id: str | None,
    unattributed: bool,
    company_id: str | None,
    product_id: str | None,
) -> AnalyticsFilters:
    return AnalyticsFilters(
        date_from=date_from,
        date_to=date_to,
        user_id=user_id,
        unattributed=unattributed,
        company_id=company_id,
        product_id=product_id,
    )


@router_analytics.get("/summary")
def analytics_summary(
    _: Annotated[JwtUser, Depends(_analytics_access)],
    db: Session = Depends(get_db),
    date_from: str = Query(alias="from"),
    date_to: str = Query(alias="to"),
    user_id: str | None = Query(default=None, alias="userId"),
    unattributed: bool = Query(default=False),
    company_id: str | None = Query(default=None, alias="companyId"),
    product_id: str | None = Query(default=None, alias="productId"),
) -> dict:
    filters = _filters_from_query(date_from, date_to, user_id, unattributed, company_id, product_id)
    return build_summary(db, filters)


@router_analytics.get("/daily")
def analytics_daily(
    _: Annotated[JwtUser, Depends(_analytics_access)],
    db: Session = Depends(get_db),
    date_from: str = Query(alias="from"),
    date_to: str = Query(alias="to"),
    user_id: str | None = Query(default=None, alias="userId"),
    unattributed: bool = Query(default=False),
    company_id: str | None = Query(default=None, alias="companyId"),
    product_id: str | None = Query(default=None, alias="productId"),
) -> dict:
    filters = _filters_from_query(date_from, date_to, user_id, unattributed, company_id, product_id)
    return build_daily(db, filters)


@router_analytics.get("/breakdowns")
def analytics_breakdowns(
    _: Annotated[JwtUser, Depends(_analytics_access)],
    db: Session = Depends(get_db),
    date_from: str = Query(alias="from"),
    date_to: str = Query(alias="to"),
    user_id: str | None = Query(default=None, alias="userId"),
    unattributed: bool = Query(default=False),
    company_id: str | None = Query(default=None, alias="companyId"),
    product_id: str | None = Query(default=None, alias="productId"),
) -> dict:
    filters = _filters_from_query(date_from, date_to, user_id, unattributed, company_id, product_id)
    return build_breakdowns(db, filters)


@router_analytics.get("/renewals")
def analytics_renewals(
    _: Annotated[JwtUser, Depends(_analytics_access)],
    db: Session = Depends(get_db),
    date_from: str = Query(alias="from"),
    date_to: str = Query(alias="to"),
    user_id: str | None = Query(default=None, alias="userId"),
    unattributed: bool = Query(default=False),
    company_id: str | None = Query(default=None, alias="companyId"),
    product_id: str | None = Query(default=None, alias="productId"),
) -> dict:
    filters = _filters_from_query(date_from, date_to, user_id, unattributed, company_id, product_id)
    return build_renewals(db, filters)


@router_audit.get("/months")
def audit_months(
    _: Annotated[JwtUser, Depends(_audit_access)],
    db: Session = Depends(get_db),
) -> dict:
    since = utcnow() - timedelta(days=365)
    rows = db.execute(
        text(
            """
            SELECT strftime('%Y-%m', "createdAt") AS month
            FROM "AuditEvent"
            WHERE "createdAt" >= :s
            GROUP BY strftime('%Y-%m', "createdAt")
            ORDER BY 1 DESC
            """
        ),
        {"s": since},
    ).fetchall()
    return {"months": [r[0] for r in rows]}


@router_audit.get("/days")
def audit_days(
    _: Annotated[JwtUser, Depends(_audit_access)],
    db: Session = Depends(get_db),
    month: str = "",
) -> dict:
    y, mo = map(int, month.split("-"))
    start = datetime(y, mo, 1)
    last_d = monthrange(y, mo)[1]
    end = datetime(y, mo, last_d, 23, 59, 59, 999000)
    rows = db.execute(
        text(
            """
            SELECT strftime('%Y-%m-%d', "createdAt") AS day
            FROM "AuditEvent"
            WHERE "createdAt" >= :f
              AND "createdAt" <= :t
            GROUP BY strftime('%Y-%m-%d', "createdAt")
            ORDER BY 1 ASC
            """
        ),
        {"f": start, "t": end},
    ).fetchall()
    return {"days": [r[0] for r in rows]}


@router_audit.get("/events")
def audit_events(
    _: Annotated[JwtUser, Depends(_audit_access)],
    db: Session = Depends(get_db),
    date: str = "",
    page: str | None = None,
    limit: str | None = None,
) -> dict:
    if not date:
        raise HTTPException(400, detail={"statusCode": 400, "message": "date required", "error": "Bad Request"})
    d = datetime.fromisoformat(date[:10])
    day_start = datetime(d.year, d.month, d.day, 0, 0, 0)
    day_end = datetime(d.year, d.month, d.day, 23, 59, 59, 999000)
    p, lim = _page_limit(page, limit)
    skip = (p - 1) * lim
    q = (
        db.query(AuditEvent)
        .options(joinedload(AuditEvent.user))
        .filter(AuditEvent.createdAt >= day_start, AuditEvent.createdAt <= day_end)
    )
    total = q.count()
    rows = q.order_by(AuditEvent.createdAt.desc()).offset(skip).limit(lim).all()
    items = []
    for ev in rows:
        ulogin = ev.user.login if ev.user else None
        desc = describe_audit_event(
            action=ev.action,
            entity_type=ev.entityType,
            entity_id=ev.entityId,
            payload=ev.payload,
            user_login=ulogin,
        )
        items.append(
            {
                "id": ev.id,
                "userId": ev.userId,
                "action": ev.action,
                "entityType": ev.entityType,
                "entityId": ev.entityId,
                "payload": ev.payload,
                "createdAt": ev.createdAt.isoformat() + "Z",
                "user": {"id": ev.user.id, "login": ev.user.login} if ev.user else None,
                "descriptionRu": desc,
            }
        )
    return {"items": items, "total": total, "page": p, "limit": lim}


def run_audit_purge_job() -> None:
    from selakcrm.database import SessionLocal

    db = SessionLocal()
    try:
        purge_audit_older_than_one_year(db)
        db.commit()
    finally:
        db.close()
