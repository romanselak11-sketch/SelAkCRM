from __future__ import annotations

from datetime import datetime

from selakcrm.domain.policy_dates import calendar_days_until_end
from selakcrm.models import RenewalTask


def renewal_task_date_sort_key(task: RenewalTask, today: datetime) -> tuple[int, int]:
    """Просроченные выше; среди них — чем больше просрочка, тем выше (меньше days_left)."""
    days_left = calendar_days_until_end(task.policy.endDate, today)
    if days_left < 0:
        return (0, days_left)
    return (1, days_left)


def sort_renewal_tasks_by_policy_date(tasks: list[RenewalTask], today: datetime) -> list[RenewalTask]:
    return sorted(tasks, key=lambda t: renewal_task_date_sort_key(t, today))
