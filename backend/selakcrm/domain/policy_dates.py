from __future__ import annotations

import re
from datetime import date, datetime

from selakcrm.time_utils import utcnow


def start_of_day(d: datetime | date) -> datetime:
    if isinstance(d, date) and not isinstance(d, datetime):
        return datetime(d.year, d.month, d.day)
    return datetime(d.year, d.month, d.day, 0, 0, 0, 0)


def calendar_date_from_ymd(iso_date: str) -> datetime:
    ymd = iso_date[:10]
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})$", ymd)
    if not m:
        return start_of_day(datetime.fromisoformat(iso_date.replace("Z", "+00:00")))
    y, mo, d = int(m[1]), int(m[2]), int(m[3])
    dt = datetime(y, mo, d)
    if dt.year != y or dt.month != mo or dt.day != d:
        return start_of_day(datetime.fromisoformat(iso_date.replace("Z", "+00:00")))
    return start_of_day(dt)


def calendar_days_until_end(end_date: datetime, from_dt: datetime | None = None) -> int:
    frm = from_dt or utcnow()
    e = start_of_day(end_date).date()
    f = start_of_day(frm).date()
    return (e - f).days


def is_in_renewal_window(end_date: datetime, from_dt: datetime | None = None) -> bool:
    d = calendar_days_until_end(end_date, from_dt)
    return 0 <= d <= 30


def same_calendar_day(a: datetime, b: datetime) -> bool:
    return start_of_day(a).date() == start_of_day(b).date()
