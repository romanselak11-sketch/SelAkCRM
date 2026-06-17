from __future__ import annotations

from selakcrm.models import RenewalTask, RenewalTaskComment


def renewal_task_comment_history(task: RenewalTask) -> list[dict]:
    return [
        {
            "createdAt": c.createdAt.isoformat() + "Z",
            "kind": c.kind,
            "text": c.text,
        }
        for c in task.comments
    ]


def latest_renewal_task_comment(task: RenewalTask, kind: str) -> str | None:
    matched = [c for c in task.comments if c.kind == kind]
    if not matched:
        return None
    latest: RenewalTaskComment = max(matched, key=lambda c: c.createdAt)
    return latest.text
