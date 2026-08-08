"""Analytics aggregations for SUPER_ADMIN dashboard."""

from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from fastapi import HTTPException
from sqlalchemy import Float, cast, func, text
from sqlalchemy.orm import Session

from selakcrm.models import InsuranceCompany, InsuranceProduct, Policy, RenewalTask, User
from selakcrm.services.renewal_sync import OPEN_RENEWAL_STATUSES
from selakcrm.time_utils import utcnow

BREAKDOWN_TOP_N = 8
MAX_ANALYTICS_PERIOD_DAYS = 367


class AnalyticsFilters:
    def __init__(
        self,
        *,
        date_from: str,
        date_to: str,
        user_id: str | None = None,
        unattributed: bool = False,
        company_id: str | None = None,
        product_id: str | None = None,
    ) -> None:
        if user_id and unattributed:
            raise HTTPException(
                400,
                detail={
                    "statusCode": 400,
                    "message": "Нельзя сочетать userId и unattributed",
                    "error": "Bad Request",
                },
            )
        try:
            self.from_d = datetime.fromisoformat(date_from[:10])
            self.to_d = datetime.fromisoformat(date_to[:10])
        except ValueError as e:
            raise HTTPException(
                400,
                detail={"statusCode": 400, "message": "Некорректная дата from/to", "error": "Bad Request"},
            ) from e
        if self.from_d > self.to_d:
            raise HTTPException(
                400,
                detail={
                    "statusCode": 400,
                    "message": "Дата начала не может быть позже даты окончания",
                    "error": "Bad Request",
                },
            )
        self.to_end = datetime(self.to_d.year, self.to_d.month, self.to_d.day, 23, 59, 59, 999000)
        self.period_days = (self.to_d.date() - self.from_d.date()).days + 1
        if self.period_days > MAX_ANALYTICS_PERIOD_DAYS:
            raise HTTPException(
                400,
                detail={
                    "statusCode": 400,
                    "message": f"Период не может превышать {MAX_ANALYTICS_PERIOD_DAYS} дней",
                    "error": "Bad Request",
                },
            )
        prev_last_day = self.from_d - timedelta(days=1)
        self.prev_end = datetime(
            prev_last_day.year, prev_last_day.month, prev_last_day.day, 23, 59, 59, 999000
        )
        prev_start_day = prev_last_day - timedelta(days=self.period_days - 1)
        self.prev_start = datetime(prev_start_day.year, prev_start_day.month, prev_start_day.day, 0, 0, 0)
        self.user_id = user_id or None
        self.unattributed = unattributed
        self.company_id = company_id or None
        self.product_id = product_id or None


def _policy_day_expr():
    return func.coalesce(Policy.issueDate, Policy.createdAt)


def _apply_policy_filters(q, filters: AnalyticsFilters):
    q = q.filter(Policy.deletedAt.is_(None))
    if filters.user_id:
        q = q.filter(Policy.createdByUserId == filters.user_id)
    elif filters.unattributed:
        q = q.filter(Policy.createdByUserId.is_(None))
    if filters.company_id:
        q = q.filter(Policy.companyId == filters.company_id)
    if filters.product_id:
        q = q.filter(Policy.productId == filters.product_id)
    return q


def _money_str(value: Decimal | float | int | str | None) -> str:
    d = Decimal(str(value or 0))
    return format(d.quantize(Decimal("0.01")), "f")


def _agg_policies(db: Session, filters: AnalyticsFilters, start: datetime, end: datetime) -> tuple[Decimal, int]:
    policy_day = _policy_day_expr()
    revenue_expr = func.coalesce(func.sum(cast(Policy.agentIncomeD, Float)), 0.0)
    count_expr = func.count(Policy.id)
    q = db.query(revenue_expr, count_expr)
    q = _apply_policy_filters(q, filters)
    q = q.filter(policy_day >= start, policy_day <= end)
    row = q.one()
    rev = Decimal(str(row[0] or 0))
    cnt = int(row[1] or 0)
    return rev, cnt


def _delta_pct(cur: float, prev: float) -> float | None:
    if prev == 0:
        return 0.0 if cur == 0 else None
    return ((cur - prev) / prev) * 100


def build_summary(db: Session, filters: AnalyticsFilters) -> dict[str, Any]:
    cur_sum, cur_cnt = _agg_policies(db, filters, filters.from_d, filters.to_end)
    prev_sum, prev_cnt = _agg_policies(db, filters, filters.prev_start, filters.prev_end)
    avg = _money_str(cur_sum / cur_cnt) if cur_cnt > 0 else None
    return {
        "revenue": _money_str(cur_sum),
        "policiesCount": cur_cnt,
        "avgAgentIncome": avg,
        "prevRevenue": _money_str(prev_sum),
        "prevPoliciesCount": prev_cnt,
        "periodDays": filters.period_days,
        "prevFrom": filters.prev_start.strftime("%Y-%m-%d"),
        "prevTo": filters.prev_end.strftime("%Y-%m-%d"),
        "revenueDeltaPct": _delta_pct(float(cur_sum), float(prev_sum)),
        "policiesDeltaPct": _delta_pct(float(cur_cnt), float(prev_cnt)),
    }


def build_daily(db: Session, filters: AnalyticsFilters) -> dict[str, Any]:
    clauses = ['"deletedAt" IS NULL']
    params: dict[str, Any] = {"f": filters.from_d, "t": filters.to_end}
    if filters.user_id:
        clauses.append('"createdByUserId" = :uid')
        params["uid"] = filters.user_id
    elif filters.unattributed:
        clauses.append('"createdByUserId" IS NULL')
    if filters.company_id:
        clauses.append('"companyId" = :cid')
        params["cid"] = filters.company_id
    if filters.product_id:
        clauses.append('"productId" = :pid')
        params["pid"] = filters.product_id
    where_sql = " AND ".join(clauses)
    rows = db.execute(
        text(
            f"""
            SELECT date(COALESCE("issueDate", "createdAt")) AS day,
                   CAST(COALESCE(SUM(CAST("agentIncomeD" AS REAL)), 0) AS TEXT) AS revenue,
                   CAST(COUNT(*) AS INTEGER) AS policies_count
            FROM "Policy"
            WHERE {where_sql}
              AND COALESCE("issueDate", "createdAt") >= :f
              AND COALESCE("issueDate", "createdAt") <= :t
            GROUP BY date(COALESCE("issueDate", "createdAt"))
            ORDER BY 1
            """
        ),
        params,
    ).fetchall()
    m = {r[0]: {"revenue": r[1], "policiesCount": int(r[2])} for r in rows}
    points = []
    d = filters.from_d.date()
    end = filters.to_d.date()
    while d <= end:
        key = d.strftime("%Y-%m-%d")
        v = m.get(key)
        points.append(
            {
                "day": key,
                "revenue": v["revenue"] if v else "0",
                "policiesCount": v["policiesCount"] if v else 0,
            }
        )
        d += timedelta(days=1)
    return {"points": points}


def _breakdown_rows(
    db: Session,
    filters: AnalyticsFilters,
    *,
    group_id_col,
    group_name_col,
    join_model,
    join_on,
    null_label: str,
) -> list[dict[str, Any]]:
    revenue_expr = func.coalesce(func.sum(cast(Policy.agentIncomeD, Float)), 0.0)
    count_expr = func.count(Policy.id)
    policy_day = _policy_day_expr()
    q = (
        db.query(group_id_col, group_name_col, revenue_expr, count_expr)
        .select_from(Policy)
        .outerjoin(join_model, join_on)
    )
    q = _apply_policy_filters(q, filters)
    q = q.filter(policy_day >= filters.from_d, policy_day <= filters.to_end)
    q = q.group_by(group_id_col, group_name_col).order_by(revenue_expr.desc())
    rows = q.all()
    items: list[dict[str, Any]] = []
    for gid, gname, rev, cnt in rows:
        items.append(
            {
                "id": gid,
                "name": gname or null_label,
                "revenue": _money_str(rev),
                "policiesCount": int(cnt or 0),
            }
        )
    if len(items) <= BREAKDOWN_TOP_N:
        return items
    top = items[:BREAKDOWN_TOP_N]
    rest = items[BREAKDOWN_TOP_N:]
    other_rev = sum((Decimal(x["revenue"]) for x in rest), Decimal(0))
    other_cnt = sum(x["policiesCount"] for x in rest)
    top.append(
        {
            "id": None,
            "name": "Прочие",
            "revenue": _money_str(other_rev),
            "policiesCount": other_cnt,
        }
    )
    return top


def build_breakdowns(db: Session, filters: AnalyticsFilters) -> dict[str, Any]:
    by_company = _breakdown_rows(
        db,
        filters,
        group_id_col=Policy.companyId,
        group_name_col=InsuranceCompany.name,
        join_model=InsuranceCompany,
        join_on=InsuranceCompany.id == Policy.companyId,
        null_label="—",
    )
    by_product = _breakdown_rows(
        db,
        filters,
        group_id_col=Policy.productId,
        group_name_col=InsuranceProduct.name,
        join_model=InsuranceProduct,
        join_on=InsuranceProduct.id == Policy.productId,
        null_label="—",
    )
    by_user: list[dict[str, Any]] = []
    if not filters.user_id and not filters.unattributed:
        by_user = _breakdown_rows(
            db,
            filters,
            group_id_col=Policy.createdByUserId,
            group_name_col=User.login,
            join_model=User,
            join_on=User.id == Policy.createdByUserId,
            null_label="Без атрибуции",
        )
    return {"byUser": by_user, "byCompany": by_company, "byProduct": by_product}


def _apply_renewal_policy_scope(q, filters: AnalyticsFilters):
    q = q.join(Policy, Policy.id == RenewalTask.policyId).filter(Policy.deletedAt.is_(None))
    if filters.user_id:
        q = q.filter(Policy.createdByUserId == filters.user_id)
    elif filters.unattributed:
        q = q.filter(Policy.createdByUserId.is_(None))
    if filters.company_id:
        q = q.filter(Policy.companyId == filters.company_id)
    if filters.product_id:
        q = q.filter(Policy.productId == filters.product_id)
    return q


def build_renewals(db: Session, filters: AnalyticsFilters) -> dict[str, Any]:
    today = utcnow()
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)

    open_q = db.query(func.count(RenewalTask.id)).filter(RenewalTask.status.in_(OPEN_RENEWAL_STATUSES))
    open_q = _apply_renewal_policy_scope(open_q, filters)
    open_count = int(open_q.scalar() or 0)

    overdue_q = db.query(func.count(RenewalTask.id)).filter(RenewalTask.status.in_(OPEN_RENEWAL_STATUSES))
    overdue_q = _apply_renewal_policy_scope(overdue_q, filters).filter(Policy.endDate < today_start)
    overdue_count = int(overdue_q.scalar() or 0)

    renewed_q = db.query(func.count(RenewalTask.id)).filter(
        RenewalTask.status == "RENEWED",
        RenewalTask.statusChangedAt >= filters.from_d,
        RenewalTask.statusChangedAt <= filters.to_end,
    )
    renewed_q = _apply_renewal_policy_scope(renewed_q, filters)
    renewed_count = int(renewed_q.scalar() or 0)

    declined_q = db.query(func.count(RenewalTask.id)).filter(
        RenewalTask.status == "CLIENT_DECLINED",
        RenewalTask.statusChangedAt >= filters.from_d,
        RenewalTask.statusChangedAt <= filters.to_end,
    )
    declined_q = _apply_renewal_policy_scope(declined_q, filters)
    declined_count = int(declined_q.scalar() or 0)

    denom = renewed_count + declined_count
    conversion = None if denom == 0 else round((renewed_count / denom) * 100, 1)

    return {
        "openCount": open_count,
        "overdueCount": overdue_count,
        "renewedInPeriod": renewed_count,
        "declinedInPeriod": declined_count,
        "conversionPct": conversion,
    }
