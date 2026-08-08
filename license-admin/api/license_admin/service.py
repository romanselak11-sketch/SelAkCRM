from __future__ import annotations

import base64
import json
import secrets
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from license_admin.ledger import (
    Activation,
    KeyStatus,
    License,
    license_from_dict,
    license_to_dict,
)
from license_admin.paths import find_project_root, project_layout
from selakcrm.licensing.activation_code import (
    ActivationRequest,
    issue_activation_code as sign_activation_code,
)
from selakcrm.licensing.crypto import generate_keypair
from selakcrm.licensing.keys import InvalidKeyFormat, issue_license_key, parse_full_key
from selakcrm.time_utils import utcnow


def _fernet_from_password(password: str, salt: bytes) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=390_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode("utf-8")))
    return Fernet(key)


@dataclass
class LocalNote:
    note: str = ""
    labels: dict[str, str] = field(default_factory=dict)  # hwid -> label


@dataclass
class AdminState:
    notes: dict[str, LocalNote] = field(default_factory=dict)  # license id -> note
    vault: dict[str, str] = field(default_factory=dict)  # license id -> raw key (plaintext in mem)
    audit: list[dict[str, Any]] = field(default_factory=list)
    licenses: list[dict[str, Any]] = field(default_factory=list)
    unlocked: bool = False


class LicenseAdminService:
    def __init__(
        self,
        data_dir: Path | None = None,
        *,
        project_root: Path | None = None,
    ) -> None:
        if project_root is not None:
            self.project_root = Path(project_root).resolve()
        else:
            try:
                self.project_root = find_project_root()
            except RuntimeError:
                # Тесты / изолированный запуск без монорепо.
                self.project_root = (data_dir or Path.cwd()).resolve()
        self.paths = project_layout(self.project_root)
        for key in ("keys", "data"):
            self.paths[key].mkdir(parents=True, exist_ok=True)
        self.data_dir = Path(data_dir) if data_dir is not None else self.paths["data"]
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.state_path = self.data_dir / "state.json"
        self.vault_path = self.data_dir / "vault.bin"
        self.salt_path = self.data_dir / "vault.salt"
        self._password: str | None = None
        self.state = AdminState()
        self._load_state()

    def project_info(self) -> dict[str, str]:
        return {
            "projectRoot": str(self.project_root),
            "dataDir": str(self.data_dir),
            "privateKey": str(self.paths["private_key"]),
            "publicKey": str(self.paths["public_key"]),
            "crmPublicKey": str(self.paths["crm_public_key"]),
        }

    def _load_state(self) -> None:
        if not self.state_path.is_file():
            return
        data = json.loads(self.state_path.read_text(encoding="utf-8"))
        notes = {
            k: LocalNote(note=v.get("note", ""), labels=dict(v.get("labels") or {}))
            for k, v in (data.get("notes") or {}).items()
        }
        raw_licenses = data.get("licenses")
        if raw_licenses is None:
            # Состояние прежней схемы с подписанным реестром.
            raw_licenses = (data.get("registry") or {}).get("licenses") or []
        self.state = AdminState(
            notes=notes,
            vault={},
            audit=list(data.get("audit") or []),
            licenses=[license_to_dict(license_from_dict(x)) for x in raw_licenses],
            unlocked=False,
        )

    def _save_state(self) -> None:
        payload = {
            "notes": {k: asdict(v) for k, v in self.state.notes.items()},
            "audit": self.state.audit[-500:],
            "licenses": self.state.licenses,
        }
        self.state_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )

    def _audit(self, action: str, detail: dict[str, Any] | None = None) -> None:
        self.state.audit.append(
            {
                "at": utcnow().isoformat() + "Z",
                "action": action,
                "detail": detail or {},
            }
        )

    def unlock(self, password: str) -> None:
        if not self.salt_path.is_file():
            salt = secrets.token_bytes(16)
            self.salt_path.write_bytes(salt)
            f = _fernet_from_password(password, salt)
            self.vault_path.write_bytes(f.encrypt(json.dumps({}).encode("utf-8")))
        else:
            salt = self.salt_path.read_bytes()
            f = _fernet_from_password(password, salt)
            try:
                raw = f.decrypt(self.vault_path.read_bytes())
            except InvalidToken as exc:
                raise ValueError("Неверный пароль vault") from exc
            self.state.vault = json.loads(raw.decode("utf-8"))
        self._password = password
        self.state.unlocked = True

    def _persist_vault(self) -> None:
        if not self._password:
            raise RuntimeError("vault locked")
        salt = self.salt_path.read_bytes()
        f = _fernet_from_password(self._password, salt)
        self.vault_path.write_bytes(f.encrypt(json.dumps(self.state.vault).encode("utf-8")))

    def require_unlocked(self) -> None:
        if not self.state.unlocked:
            raise RuntimeError("Сначала разблокируйте vault паролем")

    def ensure_keys(self) -> dict[str, str]:
        self.require_unlocked()
        priv = self.paths["private_key"]
        pub = self.paths["public_key"]
        priv.parent.mkdir(parents=True, exist_ok=True)
        if not priv.is_file() or not pub.is_file():
            private_pem, public_pem = generate_keypair()
            priv.write_bytes(private_pem)
            pub.write_bytes(public_pem)
            try:
                priv.chmod(0o600)
                pub.chmod(0o644)
            except OSError:
                pass
            self._audit("generate_keypair", {"private": str(priv), "public": str(pub)})
        self._sync_public_to_crm()
        self._save_state()
        return {"privateKeyPath": str(priv), "publicKeyPath": str(pub)}

    def _sync_public_to_crm(self) -> None:
        """Публичный ключ копируется в backend для сборки клиента."""
        src = self.paths["public_key"]
        dst = self.paths["crm_public_key"]
        if not src.is_file():
            return
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(src.read_bytes())

    def _private_pem(self) -> bytes:
        path = self.paths["private_key"]
        if not path.is_file():
            raise RuntimeError("Приватный ключ не найден — разблокируйте vault и дождитесь ensure-keys")
        return path.read_bytes()

    def _licenses(self) -> list[License]:
        return [license_from_dict(x) for x in self.state.licenses]

    def _store_licenses(self, licenses: list[License]) -> None:
        self.state.licenses = [license_to_dict(x) for x in licenses]

    def list_licenses(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for lic in self._licenses():
            note = self.state.notes.get(lic.id, LocalNote())
            out.append(
                {
                    "id": lic.id,
                    "keyId": lic.key_id,
                    "status": lic.status.value,
                    "maxSeats": lic.max_seats,
                    "activationsCount": len(lic.activations),
                    "createdAt": lic.created_at,
                    "note": note.note,
                    "activations": [
                        {
                            "hwid": a.hwid,
                            "activatedAt": a.activated_at,
                            "label": note.labels.get(a.hwid, ""),
                        }
                        for a in lic.activations
                    ],
                    "hasVaultKey": lic.id in self.state.vault,
                }
            )
        return out

    def create_license(
        self,
        *,
        note: str,
        max_seats: int | None,
    ) -> dict[str, Any]:
        self.require_unlocked()
        self.ensure_keys()
        if max_seats is not None and max_seats < 1:
            raise ValueError("Число устройств должно быть не меньше 1")
        licenses = self._licenses()
        existing_ids = {lic.key_id for lic in licenses}
        issued = None
        for _ in range(32):
            candidate = issue_license_key(key_id_bytes=4, secret_bytes=24)
            if candidate.key_id not in existing_ids:
                issued = candidate
                break
        if issued is None:
            raise RuntimeError("Не удалось сгенерировать уникальный key_id")
        lic_id = f"lic_{secrets.token_hex(8)}"
        lic = License(
            id=lic_id,
            key_id=issued.key_id,
            status=KeyStatus.ACTIVE,
            max_seats=max_seats,
            created_at=utcnow().isoformat(),
            activations=(),
        )
        self._store_licenses([*licenses, lic])
        self.state.notes[lic_id] = LocalNote(note=note)
        self.state.vault[lic_id] = issued.full_key
        self._persist_vault()
        self._audit("create_license", {"id": lic_id, "maxSeats": max_seats})
        self._save_state()
        return {
            "id": lic_id,
            "keyId": issued.key_id,
            "fullKey": issued.full_key,
            "maxSeats": max_seats,
        }

    def revoke(self, license_id: str) -> None:
        self.require_unlocked()
        licenses = self._licenses()
        if not any(lic.id == license_id for lic in licenses):
            raise KeyError(license_id)
        self._store_licenses(
            [lic.with_status(KeyStatus.REVOKED) if lic.id == license_id else lic for lic in licenses]
        )
        self._audit("revoke", {"id": license_id})
        self._save_state()

    def deallocate(self, license_id: str, hwid: str) -> None:
        self.require_unlocked()
        licenses = self._licenses()
        if not any(lic.id == license_id for lic in licenses):
            raise KeyError(license_id)
        updated: list[License] = []
        for lic in licenses:
            if lic.id != license_id:
                updated.append(lic)
                continue
            updated.append(lic.with_activations(tuple(a for a in lic.activations if a.hwid != hwid)))
            note = self.state.notes.get(lic.id)
            if note:
                note.labels.pop(hwid, None)
        self._store_licenses(updated)
        self._audit("deallocate", {"id": license_id, "hwid": hwid})
        self._save_state()

    def issue_activation_code(self, encoded_request: str, label: str | None = None) -> dict[str, Any]:
        """Проверить код запроса клиента, занять место и вернуть код ответа."""
        self.require_unlocked()
        try:
            req = ActivationRequest.decode(encoded_request)
        except InvalidKeyFormat as exc:
            raise ValueError("Это не код запроса. Скопируйте строку целиком из CRM клиента.") from exc
        licenses = self._licenses()
        target = next((lic for lic in licenses if lic.key_id == req.key_id), None)
        if target is None:
            raise ValueError("Ключ из кода запроса не найден среди выданных")
        if target.status == KeyStatus.REVOKED:
            raise ValueError("Ключ отозван — новые устройства активировать нельзя")
        raw = self.state.vault.get(target.id)
        if not raw:
            raise ValueError("Полного ключа нет в vault — проверить код запроса невозможно")
        try:
            parsed_vault = parse_full_key(raw)
        except InvalidKeyFormat as exc:
            raise ValueError("Повреждённый ключ в vault") from exc
        if not req.verify(parsed_vault.secret):
            raise ValueError("Код запроса повреждён или относится к другому ключу")

        already = target.find_activation(req.hwid) is not None
        if not already:
            if not target.has_free_seat():
                raise ValueError(
                    f"Все места заняты ({len(target.activations)} из {target.max_seats}). "
                    "Снимите ненужное устройство и повторите."
                )
            activation = Activation(hwid=req.hwid, activated_at=utcnow().isoformat())
            target = target.with_activations((*target.activations, activation))
            self._store_licenses([target if lic.id == target.id else lic for lic in licenses])

        note = self.state.notes.setdefault(target.id, LocalNote())
        if label:
            note.labels[req.hwid] = label
        code = sign_activation_code(target.key_id, req.hwid, self._private_pem())
        self._audit(
            "issue_code",
            {"id": target.id, "hwid": req.hwid, "reissue": already},
        )
        self._save_state()
        return {
            "code": code,
            "keyId": target.key_id,
            "hwid": req.hwid,
            "reissue": already,
            "seatsUsed": len(target.activations),
            "maxSeats": target.max_seats,
        }

    def reveal_key(self, license_id: str) -> str:
        self.require_unlocked()
        key = self.state.vault.get(license_id)
        if not key:
            raise KeyError(license_id)
        return key
