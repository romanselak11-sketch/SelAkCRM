from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class LicenseStatus(str, Enum):
    DEMO = "demo"
    FULL = "full"
    BLOCKED = "blocked"
    PENDING_ACTIVATION = "pending_activation"


class BlockedReason(str, Enum):
    TRIAL_EXPIRED = "trial_expired"
    CLOCK_ROLLBACK = "clock_rollback"
    INVALID_KEY = "invalid_key"
    CODE_MISMATCH = "code_mismatch"


@dataclass(frozen=True)
class TrialMarker:
    hwid: str
    started_at: str
    last_seen_at: str
    trial_days: int = 7


@dataclass(frozen=True)
class GuardState:
    status: LicenseStatus
    reason: BlockedReason | None = None
    remaining_seconds: int | None = None
