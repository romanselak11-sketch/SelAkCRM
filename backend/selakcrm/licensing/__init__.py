"""Офлайн-лицензирование: ключи, коды активации, демо-период, гейт доступа."""

from selakcrm.licensing.models import (
    BlockedReason,
    GuardState,
    LicenseStatus,
    TrialMarker,
)

__all__ = [
    "BlockedReason",
    "GuardState",
    "LicenseStatus",
    "TrialMarker",
]
