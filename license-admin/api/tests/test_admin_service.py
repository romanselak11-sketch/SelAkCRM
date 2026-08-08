from __future__ import annotations

from pathlib import Path

import pytest
from license_admin.ledger import KeyStatus
from license_admin.service import LicenseAdminService

from selakcrm.licensing.activation_code import build_activation_request, verify_activation_code
from selakcrm.licensing.keys import parse_full_key


def _mini_project(tmp_path: Path) -> Path:
    """Структура как у монорепо, чтобы пути админки резолвились в tmp."""
    (tmp_path / "license-admin").mkdir()
    (tmp_path / "backend" / "selakcrm" / "licensing").mkdir(parents=True)
    return tmp_path


def _service(root: Path) -> LicenseAdminService:
    svc = LicenseAdminService(data_dir=root / "license-admin" / "data", project_root=root)
    svc.unlock("test-password-123")
    return svc


def _request_code(full_key: str, hwid: str) -> str:
    return build_activation_request(parse_full_key(full_key), hwid).encode()


def test_create_key_and_issue_activation_code(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="Acme", max_seats=2)
    assert created["fullKey"].startswith("SAK-")
    assert created["id"] in svc.state.vault
    assert len(created["keyId"].split("-", 1)[1]) == 8

    result = svc.issue_activation_code(_request_code(created["fullKey"], "hw_office"), label="офис")
    assert result["code"].startswith("SAKACT-")
    assert result["reissue"] is False
    assert result["seatsUsed"] == 1

    public = (root / "license-admin" / "keys" / "public.pem").read_bytes()
    assert verify_activation_code(result["code"], created["keyId"], "hw_office", [public])

    rows = svc.list_licenses()
    assert rows[0]["activationsCount"] == 1
    assert rows[0]["activations"][0]["label"] == "офис"


def test_public_key_synced_to_crm(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    svc.create_license(note="A", max_seats=1)
    assert (root / "backend" / "selakcrm" / "licensing" / "public.pem").is_file()


def test_seat_limit_enforced(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="One seat", max_seats=1)
    svc.issue_activation_code(_request_code(created["fullKey"], "hw_first"))
    with pytest.raises(ValueError, match="Все места заняты"):
        svc.issue_activation_code(_request_code(created["fullKey"], "hw_second"))


def test_reissue_for_same_machine_keeps_one_seat(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="One seat", max_seats=1)
    first = svc.issue_activation_code(_request_code(created["fullKey"], "hw_same"))
    again = svc.issue_activation_code(_request_code(created["fullKey"], "hw_same"))
    assert again["reissue"] is True
    assert again["seatsUsed"] == 1
    assert again["code"] == first["code"]


def test_deallocate_frees_seat(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="One seat", max_seats=1)
    svc.issue_activation_code(_request_code(created["fullKey"], "hw_old"))
    svc.deallocate(created["id"], "hw_old")
    assert svc.list_licenses()[0]["activationsCount"] == 0
    svc.issue_activation_code(_request_code(created["fullKey"], "hw_new"))
    assert svc.list_licenses()[0]["activations"][0]["hwid"] == "hw_new"


def test_unlimited_seats_when_max_is_none(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="Unlimited", max_seats=None)
    for hwid in ("hw_a", "hw_b", "hw_c"):
        svc.issue_activation_code(_request_code(created["fullKey"], hwid))
    assert svc.list_licenses()[0]["activationsCount"] == 3


def test_revoked_key_rejects_new_activations(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="X", max_seats=1)
    svc.revoke(created["id"])
    assert svc.list_licenses()[0]["status"] == KeyStatus.REVOKED.value
    with pytest.raises(ValueError, match="отозван"):
        svc.issue_activation_code(_request_code(created["fullKey"], "hw_x"))


def test_request_code_from_unknown_key_rejected(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    svc.create_license(note="known", max_seats=1)
    stranger = _request_code("SAK-ZZZZ-secretsecretsecre1", "hw_x")
    with pytest.raises(ValueError, match="не найден"):
        svc.issue_activation_code(stranger)


def test_tampered_request_code_rejected(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="A", max_seats=1)
    forged = build_activation_request(
        parse_full_key("SAK-AAAA-wrongsecretwrongse1"), "hw_x"
    )
    tampered = build_activation_request(parse_full_key(created["fullKey"]), "hw_x")
    broken = type(tampered)(key_id=tampered.key_id, hwid=tampered.hwid, mac=forged.mac)
    with pytest.raises(ValueError, match="повреждён"):
        svc.issue_activation_code(broken.encode())


def test_garbage_request_code_rejected(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    with pytest.raises(ValueError, match="код запроса"):
        svc.issue_activation_code("hw_513c77303beab6658cf9de715207d70f")


def test_max_seats_must_be_positive(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    with pytest.raises(ValueError, match="не меньше 1"):
        svc.create_license(note="bad", max_seats=0)


def test_state_survives_restart(tmp_path: Path) -> None:
    root = _mini_project(tmp_path)
    svc = _service(root)
    created = svc.create_license(note="Acme", max_seats=2)
    svc.issue_activation_code(_request_code(created["fullKey"], "hw_office"), label="офис")

    reopened = _service(root)
    rows = reopened.list_licenses()
    assert rows[0]["keyId"] == created["keyId"]
    assert rows[0]["activationsCount"] == 1
    assert rows[0]["activations"][0]["label"] == "офис"
    assert reopened.reveal_key(created["id"]) == created["fullKey"]
