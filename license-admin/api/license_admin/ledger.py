"""Локальный журнал выданных лицензий вендора.

Живёт только на машине вендора (`license-admin/data/state.json`). Клиентам ничего
не публикуется: лимит мест проверяется здесь, в момент выдачи кода активации.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class KeyStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"


@dataclass(frozen=True)
class Activation:
    hwid: str
    activated_at: str


@dataclass(frozen=True)
class License:
    id: str
    key_id: str
    status: KeyStatus
    max_seats: int | None
    created_at: str
    activations: tuple[Activation, ...] = field(default_factory=tuple)

    def find_activation(self, hwid: str) -> Activation | None:
        for act in self.activations:
            if act.hwid == hwid:
                return act
        return None

    def has_free_seat(self) -> bool:
        if self.max_seats is None:
            return True
        return len(self.activations) < self.max_seats

    def with_activations(self, activations: tuple[Activation, ...]) -> License:
        return License(
            id=self.id,
            key_id=self.key_id,
            status=self.status,
            max_seats=self.max_seats,
            created_at=self.created_at,
            activations=activations,
        )

    def with_status(self, status: KeyStatus) -> License:
        return License(
            id=self.id,
            key_id=self.key_id,
            status=status,
            max_seats=self.max_seats,
            created_at=self.created_at,
            activations=self.activations,
        )


def license_to_dict(lic: License) -> dict[str, Any]:
    return {
        "id": lic.id,
        "key_id": lic.key_id,
        "status": lic.status.value,
        "max_seats": lic.max_seats,
        "created_at": lic.created_at,
        "activations": [{"hwid": a.hwid, "activated_at": a.activated_at} for a in lic.activations],
    }


def license_from_dict(raw: dict[str, Any]) -> License:
    max_seats = raw.get("max_seats")
    try:
        status = KeyStatus(raw.get("status", KeyStatus.ACTIVE.value))
    except ValueError:
        status = KeyStatus.ACTIVE
    activations = tuple(
        Activation(hwid=str(a["hwid"]), activated_at=str(a.get("activated_at", "")))
        for a in (raw.get("activations") or [])
        if isinstance(a, dict) and a.get("hwid")
    )
    return License(
        id=str(raw["id"]),
        key_id=str(raw["key_id"]),
        status=status,
        max_seats=int(max_seats) if max_seats is not None else None,
        created_at=str(raw.get("created_at", "")),
        activations=activations,
    )
