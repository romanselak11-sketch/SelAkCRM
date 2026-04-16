from calendar import monthrange
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session, joinedload

from selakcrm.database import get_db
from selakcrm.deps import JwtUser, get_current_user, require_roles
from selakcrm.models import AuditEvent, Policy
from selakcrm.services.audit_description import describe_audit_event
from selakcrm.services.audit_log import purge_audit_older_than_one_year
from selakcrm.time_utils import utcnow

router_analytics = APIRouter(prefix="/analytics", tags=["analytics"])
router_audit = APIRouter(prefix="/audit", tags=["audit"])

ALLOWED_LIMITS = {10, 25, 50}


def _page_limit(page_raw: str | None, limit_raw: str | None) -> tuple[int, int]:
    try:
        lim = int(limit_raw or "10")
    except ValueError:
        lim = 10
    if lim not in ALLOWED_LIMITS:
        lim = 10
    try:
        page = int(page_raw or "1")
    except ValueError:
        page = 1
    if page < 1:
        page = 1
    return page, lim


def _admin_only(user: Annotated[JwtUser, Depends(require_roles("SUPER_ADMIN"))]) -> JwtUser:
    return user


@router_analytics.get("/summary")
def analytics_summary(
    _: Annotated[JwtUser, Depends(_admin_only)],
    db: Session = Depends(get_db),
    date_from: str = Query(alias="from"),
    date_to: str = Query(alias="to"),
) -> dict:
    from_d = datetime.fromisoformat(date_from[:10])
    to_d = datetime.fromisoformat(date_to[:10])
    to_end = datetime(to_d.year, to_d.month, to_d.day, 23, 59, 59, 999000)
    len_days = (to_d.date() - from_d.date()).days + 1
    prev_last_day = from_d - timedelta(days=1)
    prev_end = datetime(prev_last_day.year, prev_last_day.month, prev_last_day.day, 23, 59, 59, 999000)
    prev_start_day = prev_last_day - timedelta(days=len_days - 1)
    prev_start = datetime(prev_start_day.year, prev_start_day.month, prev_start_day.day, 0, 0, 0)

    def agg_between(start: datetime, end: datetime) -> tuple[Decimal, int]:
        rows = (
            db.query(Policy)
            .filter(Policy.deletedAt.is_(None), Policy.createdAt >= start, Policy.createdAt <= end)
            .all()
        )
        s = sum((Decimal(str(p.agentIncomeD)) for p in rows), Decimal(0))
        return s, len(rows)

    cur_sum, cur_cnt = agg_between(from_d, to_end)
    prev_sum, prev_cnt = agg_between(prev_start, prev_end)
    cur_num = float(cur_sum)
    prev_num = float(prev_sum)
    revenue_delta_pct: float | None
    if prev_num == 0:
        revenue_delta_pct = 0.0 if cur_num == 0 else None
    else:
        revenue_delta_pct = ((cur_num - prev_num) / prev_num) * 100
    if prev_cnt == 0:
        policies_delta_pct: float | None = 0.0 if cur_cnt == 0 else None
    else:
        policies_delta_pct = ((cur_cnt - prev_cnt) / prev_cnt) * 100

    return {
        "revenue": str(cur_sum),
        "policiesCount": cur_cnt,
        "prevRevenue": str(prev_sum),
        "prevPoliciesCount": prev_cnt,
        "periodDays": len_days,
        "prevFrom": prev_start.strftime("%Y-%m-%d"),
        "prevTo": prev_end.strftime("%Y-%m-%d"),
        "revenueDeltaPct": revenue_delta_pct,
        "policiesDeltaPct": policies_delta_pct,
    }


@router_analytics.get("/daily")
def analytics_daily(
    _: Annotated[JwtUser, Depends(_admin_only)],
    db: Session = Depends(get_db),
    date_from: str = Query(alias="from"),
    date_to: str = Query(alias="to"),
) -> dict:
    from_d = datetime.fromisoformat(date_from[:10])
    to_d = datetime.fromisoformat(date_to[:10])
    if from_d > to_d:
        return {"points": []}
    to_end = datetime(to_d.year, to_d.month, to_d.day, 23, 59, 59, 999000)
    rows = db.execute(
        text(
            """
            SELECT date("createdAt") AS day,
                   CAST(COALESCE(SUM(CAST("agentIncomeD" AS REAL)), 0) AS TEXT) AS revenue,
                   CAST(COUNT(*) AS INTEGER) AS policies_count
            FROM "Policy"
            WHERE "deletedAt" IS NULL
              AND "createdAt" >= :f
              AND "createdAt" <= :t
            GROUP BY date("createdAt")
            ORDER BY 1
            """
        ),
        {"f": from_d, "t": to_end},
    ).fetchall()
    m = {r[0]: {"revenue": r[1], "policiesCount": int(r[2])} for r in rows}
    points = []
    d = from_d.date()
    end = to_d.date()
    while d <= end:
        key = d.strftime("%Y-%m-%d")
        v = m.get(key)
        points.append({"day": key, "revenue": v["revenue"] if v else "0", "policiesCount": v["policiesCount"] if v else 0})
        d += timedelta(days=1)
    return {"points": points}


@router_audit.get("/months")
def audit_months(
    _: Annotated[JwtUser, Depends(_admin_only)],
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
    _: Annotated[JwtUser, Depends(_admin_only)],
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
    _: Annotated[JwtUser, Depends(_admin_only)],
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
