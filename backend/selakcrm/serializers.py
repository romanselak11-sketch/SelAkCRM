from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from selakcrm.domain.policy_dates import start_of_day
from selakcrm.models import (
    Client,
    ClientPhone,
    InsuranceCompany,
    InsuranceProduct,
    Policy,
    RenewalTask,
    User,
)


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def client_phone_row(cp: ClientPhone) -> dict[str, Any]:
    return {
        "id": cp.id,
        "clientId": cp.clientId,
        "phone": cp.phone,
        "phoneNormalized": cp.phoneNormalized,
        "sortOrder": cp.sortOrder,
    }


def client_row(c: Client, include_phones: bool = True) -> dict[str, Any]:
    d: dict[str, Any] = {
        "id": c.id,
        "lastName": c.lastName,
        "firstName": c.firstName,
        "middleName": c.middleName,
        "phone": c.phone,
        "phoneNormalized": c.phoneNormalized,
        "email": c.email,
        "documentsUrl": c.documentsUrl,
        "createdAt": _iso(c.createdAt),
        "updatedAt": _iso(c.updatedAt),
        "deletedAt": _iso(c.deletedAt),
    }
    if include_phones:
        phones = sorted(c.additionalPhones, key=lambda x: x.sortOrder)
        d["additionalPhones"] = [client_phone_row(p) for p in phones]
    return d


def product_row(p: InsuranceProduct) -> dict[str, Any]:
    return {
        "id": p.id,
        "companyId": p.companyId,
        "name": p.name,
        "category": p.category,
        "defaultPremiumPct": p.defaultPremiumPct,
        "createdAt": _iso(p.createdAt),
        "updatedAt": _iso(p.updatedAt),
        "deletedAt": _iso(p.deletedAt),
    }


def company_row(ic: InsuranceCompany, include_products: bool = True) -> dict[str, Any]:
    d: dict[str, Any] = {
        "id": ic.id,
        "name": ic.name,
        "createdAt": _iso(ic.createdAt),
        "updatedAt": _iso(ic.updatedAt),
        "deletedAt": _iso(ic.deletedAt),
    }
    if include_products:
        prods = [pr for pr in ic.products if pr.deletedAt is None]
        prods.sort(key=lambda x: x.name)
        d["products"] = [product_row(pr) for pr in prods]
    return d


def policy_row(p: Policy) -> dict[str, Any]:
    return {
        "id": p.id,
        "clientId": p.clientId,
        "companyId": p.companyId,
        "productId": p.productId,
        "number": p.number,
        "insuredObject": p.insuredObject,
        "category": p.category,
        "source": p.source,
        "insuranceSumS": p.insuranceSumS,
        "premiumPercent": p.premiumPercent,
        "premiumRubles": p.premiumRubles,
        "agentIncomeD": p.agentIncomeD,
        "issueDate": _iso(p.issueDate if p.issueDate is not None else p.createdAt),
        "startDate": _iso(p.startDate),
        "endDate": _iso(p.endDate),
        "termDays": p.termDays,
        "createdAt": _iso(p.createdAt),
        "updatedAt": _iso(p.updatedAt),
        "deletedAt": _iso(p.deletedAt),
    }


def policy_full(p: Policy) -> dict[str, Any]:
    d = policy_row(p)
    d["client"] = client_row(p.client, True)
    d["company"] = company_row(p.company, False)
    d["product"] = product_row(p.product)
    return d


def user_public(u: User) -> dict[str, Any]:
    return {
        "id": u.id,
        "login": u.login,
        "role": u.role,
        "theme": u.theme,
    }


def renewal_task_hours_minutes(end_date: datetime, from_dt: datetime) -> str:
    end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, 999000)
    ms = (end - from_dt).total_seconds() * 1000
    if ms <= 0:
        return "0м"
    h = int(ms // 3600000)
    m = int((ms % 3600000) // 60000)
    return f"{h}ч {m}м"


def renewal_task_overdue_duration(end_date: datetime, from_dt: datetime) -> str:
    """Длительность просрочки с конца календарного дня окончания полиса."""
    end = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, 999000)
    total_seconds = max(0, int((from_dt - end).total_seconds()))
    days = total_seconds // 86400
    remainder = total_seconds % 86400
    hours = remainder // 3600
    minutes = (remainder % 3600) // 60
    parts: list[str] = []
    if days > 0:
        parts.append(f"{days} дн.")
    if hours > 0:
        parts.append(f"{hours}ч")
    if minutes > 0 or not parts:
        parts.append(f"{minutes}м")
    return " ".join(parts)


def renewal_task_display(end_date: datetime, from_dt: datetime) -> dict[str, str | int]:
    days_left = (start_of_day(end_date).date() - start_of_day(from_dt).date()).days
    if days_left >= 1:
        return {"kind": "days", "value": days_left}
    if days_left == 0:
        return {"kind": "hm", "value": renewal_task_hours_minutes(end_date, from_dt)}
    return {"kind": "overdue", "value": renewal_task_overdue_duration(end_date, from_dt)}


def renewal_task_row_display(task: RenewalTask, from_dt: datetime) -> dict[str, str | int]:
    """Отображение срока в списке задач: для завершённых — дата закрытия, иначе — до окончания полиса."""
    if task.status == "RENEWED":
        return {"kind": "completed", "value": _iso(task.statusChangedAt) or ""}
    return renewal_task_display(task.policy.endDate, from_dt)
