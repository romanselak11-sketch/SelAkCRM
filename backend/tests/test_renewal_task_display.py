from datetime import datetime, timedelta

from selakcrm.domain.policy_dates import start_of_day
from selakcrm.models import Policy, RenewalTask
from selakcrm.serializers import renewal_task_display, renewal_task_row_display
from selakcrm.time_utils import utcnow


def test_renewal_task_display_overdue():
    today = utcnow()
    end = start_of_day(today) - timedelta(days=2)
    display = renewal_task_display(end, today)
    assert display["kind"] == "overdue"
    assert isinstance(display["value"], str)
    assert len(display["value"]) > 0


def test_renewal_task_display_days_left():
    today = utcnow()
    end = start_of_day(today) + timedelta(days=10)
    display = renewal_task_display(end, today)
    assert display["kind"] == "days"
    assert display["value"] == 10


def test_renewal_task_row_display_completed():
    today = utcnow()
    completed_at = today - timedelta(days=3)
    task = RenewalTask(
        id="task-1",
        policyId="pol-1",
        status="RENEWED",
        statusChangedAt=completed_at,
        createdAt=today,
        taskNumber=1,
    )
    task.policy = Policy(endDate=start_of_day(today) - timedelta(days=30))
    display = renewal_task_row_display(task, today)
    assert display["kind"] == "completed"
    assert display["value"].endswith("Z")
