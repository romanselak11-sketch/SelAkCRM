from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta
from threading import Lock

from sqlalchemy import exists, func, or_
from sqlalchemy.orm import Session, joinedload

from selakcrm.domain.policy_dates import calendar_days_until_end, is_in_renewal_window, start_of_day
from selakcrm.ids import new_cuid
from selakcrm.models import HomeNotification, Policy, RenewalTask, User
from selakcrm.time_utils import utcnow

log = logging.getLogger(__name__)

OPEN_RENEWAL_STATUSES = ("IN_PROGRESS", "AWAITING_FEEDBACK", "POSTPONED", "AWAITING_ACTION")
DEFAULT_SYNC_CACHE_TTL_SECONDS = 20


class RenewalSyncService:
    _sync_lock = Lock()
    _last_sync_monotonic: float = 0.0

    def __init__(self, db: Session) -> None:
        self.db = db

    def wake_expired_snoozes(self) -> None:
        now = utcnow()
        self.db.query(RenewalTask).filter(
            RenewalTask.status.in_(("POSTPONED", "AWAITING_FEEDBACK")),
            RenewalTask.snoozedUntil.isnot(None),
            RenewalTask.snoozedUntil <= now,
        ).update(
            {"status": "AWAITING_ACTION", "snoozedUntil": None, "statusChangedAt": now},
            synchronize_session=False,
        )

    def sync_after_policy_change(self) -> None:
        self.sync()

    @classmethod
    def invalidate_sync_cache(cls) -> None:
        with cls._sync_lock:
            cls._last_sync_monotonic = 0.0

    def sync_cached(self, *, ttl_seconds: int = DEFAULT_SYNC_CACHE_TTL_SECONDS) -> bool:
        self.wake_expired_snoozes()
        now_mono = time.monotonic()
        with self._sync_lock:
            if now_mono - self._last_sync_monotonic < max(0, ttl_seconds):
                return False
            self._sync_core(utcnow())
            self._last_sync_monotonic = time.monotonic()
        return True

    def sync(self) -> None:
        self.wake_expired_snoozes()
        self._sync_core(utcnow())
        with self._sync_lock:
            self._last_sync_monotonic = time.monotonic()

    def _sync_core(self, today: datetime) -> None:
        today_start = start_of_day(today)
        renewal_window_end = today_start + timedelta(days=30)

        open_task_exists = exists().where(
            RenewalTask.policyId == Policy.id,
            RenewalTask.status.in_(OPEN_RENEWAL_STATUSES),
        )

        policies = (
            self.db.query(Policy)
            .options(
                joinedload(Policy.client),
                joinedload(Policy.company),
                joinedload(Policy.product),
                joinedload(Policy.renewalTasks),
            )
            .filter(
                Policy.deletedAt.is_(None),
                or_(
                    (Policy.endDate >= today_start) & (Policy.endDate <= renewal_window_end),
                    open_task_exists,
                ),
            )
            .all()
        )

        active_user_ids = [
            r[0]
            for r in self.db.query(User.id).filter(User.deletedAt.is_(None), User.isActive == True).all()  # noqa: E712
        ]

        for p in policies:
            if p.client.deletedAt or p.company.deletedAt or p.product.deletedAt:
                self._remove_pending_tasks(p.id)
                continue

            if not is_in_renewal_window(p.endDate, today):
                self._remove_pending_tasks(p.id)
                continue

            tasks = list(p.renewalTasks)
            terminal = any(t.status in ("RENEWED", "CLIENT_DECLINED") for t in tasks)
            if terminal:
                continue

            open_task = next(
                (t for t in tasks if t.status not in ("RENEWED", "CLIENT_DECLINED")),
                None,
            )
            if not open_task:
                max_num = self.db.query(func.max(RenewalTask.taskNumber)).scalar()
                task_number = (max_num or 0) + 1
                task = RenewalTask(
                    id=new_cuid(),
                    taskNumber=task_number,
                    policyId=p.id,
                    status="IN_PROGRESS",
                    statusChangedAt=utcnow(),
                    createdAt=utcnow(),
                    updatedAt=utcnow(),
                )
                self.db.add(task)
                self.db.flush()
                self._notify_new_task_for_all_users(task.id, active_user_ids)
                log.debug("Created renewal task %s for policy %s", task.id, p.id)
            else:
                days_left = calendar_days_until_end(p.endDate, today)
                if 0 <= days_left <= 3:
                    self._notify_urgent_if_needed(p.id, today, active_user_ids)

    def _remove_pending_tasks(self, policy_id: str) -> None:
        self.db.query(RenewalTask).filter(
            RenewalTask.policyId == policy_id,
            RenewalTask.status.notin_(("RENEWED", "CLIENT_DECLINED")),
        ).delete(synchronize_session=False)

    def _notify_new_task_for_all_users(self, task_id: str, user_ids: list[str]) -> None:
        dedupe_key = f"NEW_RENEWAL_TASK:{task_id}"
        for uid in user_ids:
            exists_row = (
                self.db.query(HomeNotification.id)
                .filter(HomeNotification.userId == uid, HomeNotification.dedupeKey == dedupe_key)
                .first()
            )
            if exists_row:
                continue
            self.db.add(
                HomeNotification(
                    id=new_cuid(),
                    userId=uid,
                    type="NEW_RENEWAL_TASK",
                    dedupeKey=dedupe_key,
                    message="Появилась новая задача продления",
                    createdAt=utcnow(),
                )
            )

    def _notify_urgent_if_needed(self, policy_id: str, today: datetime, user_ids: list[str]) -> None:
        day_key = today.strftime("%Y-%m-%d")
        for uid in user_ids:
            dedupe_key = f"RENEWAL_URGENT:{policy_id}:{day_key}"
            exists_row = (
                self.db.query(HomeNotification.id)
                .filter(HomeNotification.userId == uid, HomeNotification.dedupeKey == dedupe_key)
                .first()
            )
            if exists_row:
                continue
            self.db.add(
                HomeNotification(
                    id=new_cuid(),
                    userId=uid,
                    type="RENEWAL_URGENT",
                    dedupeKey=dedupe_key,
                    message="Осталось мало времени до окончания полиса",
                    createdAt=utcnow(),
                )
            )
