from __future__ import annotations

from datetime import datetime, timedelta

from selakcrm.licensing.models import TrialMarker
from selakcrm.time_utils import parse_iso_datetime, utcnow

CLOCK_ROLLBACK_TOLERANCE = timedelta(hours=1)


def _format_iso(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat()


def new_trial_marker(hwid: str, now: datetime | None = None, trial_days: int = 7) -> TrialMarker:
    stamp = _format_iso(now or utcnow())
    return TrialMarker(hwid=hwid, started_at=stamp, last_seen_at=stamp, trial_days=trial_days)


def trial_end(marker: TrialMarker) -> datetime:
    return parse_iso_datetime(marker.started_at) + timedelta(days=marker.trial_days)


def trial_remaining_seconds(marker: TrialMarker, now: datetime | None = None) -> int:
    current = now or utcnow()
    return int((trial_end(marker) - current).total_seconds())


def is_trial_expired(marker: TrialMarker, now: datetime | None = None) -> bool:
    return trial_remaining_seconds(marker, now) <= 0


def is_clock_rollback(marker: TrialMarker, now: datetime | None = None) -> bool:
    current = now or utcnow()
    last_seen = parse_iso_datetime(marker.last_seen_at)
    return current < (last_seen - CLOCK_ROLLBACK_TOLERANCE)


def touch(marker: TrialMarker, now: datetime | None = None) -> TrialMarker:
    current = now or utcnow()
    return TrialMarker(
        hwid=marker.hwid,
        started_at=marker.started_at,
        last_seen_at=_format_iso(current),
        trial_days=marker.trial_days,
    )
