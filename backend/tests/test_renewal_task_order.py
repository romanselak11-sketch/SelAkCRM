from datetime import timedelta

from selakcrm.domain.renewal_task_order import renewal_task_date_sort_key, sort_renewal_tasks_by_policy_date
from selakcrm.time_utils import utcnow


class _FakePolicy:
    def __init__(self, end_date):
        self.endDate = end_date


class _FakeTask:
    def __init__(self, end_date):
        self.policy = _FakePolicy(end_date)


def test_overdue_tasks_sort_before_non_overdue():
    today = utcnow()
    overdue = _FakeTask(today - timedelta(days=5))
    soon = _FakeTask(today + timedelta(days=3))
    assert renewal_task_date_sort_key(overdue, today)[0] < renewal_task_date_sort_key(soon, today)[0]


def test_more_overdue_sorts_higher():
    today = utcnow()
    less = _FakeTask(today - timedelta(days=2))
    more = _FakeTask(today - timedelta(days=10))
    assert renewal_task_date_sort_key(more, today) < renewal_task_date_sort_key(less, today)
