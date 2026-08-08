from __future__ import annotations

from datetime import datetime, timedelta
from typing import Callable

import pytest

from selakcrm.licensing.activation_code import (
    ActivationRequest,
    build_activation_request,
    issue_activation_code,
    verify_activation_code,
)
from selakcrm.licensing.crypto import (
    generate_keypair,
    hmac_sha256_hex,
    sign_payload,
    verify_hmac,
    verify_payload,
)
from selakcrm.licensing.guard import (
    InMemoryLicenseCacheStore,
    InMemoryTrialStore,
    LicenseGuard,
)
from selakcrm.licensing.hwid import compute_hwid
from selakcrm.licensing.keys import InvalidKeyFormat, issue_license_key, parse_full_key
from selakcrm.licensing.models import BlockedReason, LicenseStatus
from selakcrm.licensing.trial import (
    is_clock_rollback,
    is_trial_expired,
    new_trial_marker,
    touch,
    trial_remaining_seconds,
)

FULL_KEY = "SAK-AAAA-secretsecretsecre1"


def test_crypto_sign_verify_roundtrip() -> None:
    private, public = generate_keypair()
    payload = {"hwid": "hw_1", "key_id": "SAK-AAAA", "v": 1}
    signature = sign_payload(payload, private)
    assert verify_payload(payload, signature, [public])


def test_crypto_tampered_payload_fails() -> None:
    private, public = generate_keypair()
    signature = sign_payload({"a": 1, "b": 2}, private)
    assert not verify_payload({"a": 1, "b": 3}, signature, [public])


def test_crypto_wrong_public_key_fails() -> None:
    private, _ = generate_keypair()
    _, other_public = generate_keypair()
    signature = sign_payload({"x": True}, private)
    assert not verify_payload({"x": True}, signature, [other_public])


def test_hmac_roundtrip() -> None:
    payload = {"key_id": "SAK-1", "hwid": "hw_abc"}
    mac = hmac_sha256_hex("secret", payload)
    assert verify_hmac("secret", payload, mac)
    assert not verify_hmac("other", payload, mac)
    assert not verify_hmac("secret", {**payload, "hwid": "hw_x"}, mac)


def test_hwid_deterministic() -> None:
    a = compute_hwid("seed-1")
    b = compute_hwid("seed-1")
    c = compute_hwid("seed-2")
    assert a == b
    assert a != c
    assert a.startswith("hw_")
    assert len(a) == 3 + 32


def test_trial_fresh_and_expiry() -> None:
    now = datetime(2026, 1, 1, 12, 0, 0)
    marker = new_trial_marker("hw_1", now=now, trial_days=7)
    assert not is_trial_expired(marker, now)
    assert trial_remaining_seconds(marker, now) == 7 * 24 * 3600
    assert not is_trial_expired(marker, now + timedelta(days=7) - timedelta(seconds=1))
    assert is_trial_expired(marker, now + timedelta(days=7, seconds=1))


def test_trial_touch_and_clock_rollback() -> None:
    now = datetime(2026, 1, 1, 12, 0, 0)
    marker = new_trial_marker("hw_1", now=now)
    later = now + timedelta(hours=2)
    touched = touch(marker, later)
    assert touched.started_at == marker.started_at
    assert touched.last_seen_at != marker.last_seen_at
    assert is_clock_rollback(touched, later - timedelta(days=1))
    assert not is_clock_rollback(touched, later - timedelta(minutes=10))
    assert not is_clock_rollback(touched, later + timedelta(hours=1))


def test_parse_key_rejects_bad_format() -> None:
    parsed = parse_full_key("SAK-XXXX-abcSecretabcSec12")
    assert parsed.key_id == "SAK-XXXX"
    assert parsed.secret == "abcSecretabcSec12"
    with pytest.raises(InvalidKeyFormat):
        parse_full_key("nodenominator")
    with pytest.raises(InvalidKeyFormat):
        parse_full_key("SAK-AAAA-abc-defghijklmnop")


def test_parse_key_tolerates_pasted_whitespace() -> None:
    assert parse_full_key("  SAK-XXXX-abcSecretabcSec12\n").key_id == "SAK-XXXX"


def test_issued_keys_roundtrip() -> None:
    for _ in range(50):
        issued = issue_license_key()
        again = parse_full_key(issued.full_key)
        assert again.key_id == issued.key_id
        assert again.secret == issued.secret
        assert "-" not in issued.secret


def test_request_code_roundtrip_and_mac() -> None:
    parsed = parse_full_key(FULL_KEY)
    req = build_activation_request(parsed, "hw_1")
    assert req.verify(parsed.secret)
    assert not req.verify("wrong")
    encoded = req.encode()
    assert encoded.startswith("SAKREQ-")
    decoded = ActivationRequest.decode(encoded)
    assert decoded.key_id == parsed.key_id
    assert decoded.hwid == "hw_1"
    assert decoded.verify(parsed.secret)


def test_request_code_survives_line_breaks_and_missing_prefix() -> None:
    parsed = parse_full_key(FULL_KEY)
    encoded = build_activation_request(parsed, "hw_1").encode()
    wrapped = encoded[:10] + "\n  " + encoded[10:]
    assert ActivationRequest.decode(wrapped).hwid == "hw_1"
    assert ActivationRequest.decode(encoded.removeprefix("SAKREQ-")).hwid == "hw_1"


def test_request_code_rejects_garbage() -> None:
    with pytest.raises(InvalidKeyFormat):
        ActivationRequest.decode("%%%")
    with pytest.raises(InvalidKeyFormat):
        ActivationRequest.decode("SAKREQ-" + "aGVsbG8")


def test_activation_code_binds_key_and_machine() -> None:
    private, public = generate_keypair()
    code = issue_activation_code("SAK-AAAA", "hw_1", private)
    assert code.startswith("SAKACT-")
    assert verify_activation_code(code, "SAK-AAAA", "hw_1", [public])
    assert not verify_activation_code(code, "SAK-AAAA", "hw_other", [public])
    assert not verify_activation_code(code, "SAK-BBBB", "hw_1", [public])


def test_activation_code_rejects_foreign_signer_and_garbage() -> None:
    private, _ = generate_keypair()
    _, other_public = generate_keypair()
    code = issue_activation_code("SAK-AAAA", "hw_1", private)
    assert not verify_activation_code(code, "SAK-AAAA", "hw_1", [other_public])
    assert not verify_activation_code("%%%", "SAK-AAAA", "hw_1", [other_public])


def _guard(
    *,
    hwid: str = "hw_test",
    trial_days: int = 7,
    clock: Callable[[], datetime] | None = None,
) -> tuple[LicenseGuard, InMemoryTrialStore, InMemoryLicenseCacheStore, list[bytes], bytes]:
    trial = InMemoryTrialStore()
    cache = InMemoryLicenseCacheStore()
    private, public = generate_keypair()
    fixed = datetime(2026, 1, 1, 0, 0, 0)
    guard = LicenseGuard(
        trial,
        cache,
        [public],
        hwid=hwid,
        trial_days=trial_days,
        clock=clock or (lambda: fixed),
    )
    return guard, trial, cache, [public], private


def test_guard_new_trial() -> None:
    guard, _, _, _, _ = _guard()
    state = guard.state()
    assert state.status == LicenseStatus.DEMO
    assert state.remaining_seconds == 7 * 24 * 3600
    assert guard.is_active()


def test_guard_trial_persists() -> None:
    guard, trial, cache, trusted, _ = _guard()
    first = guard.state()
    guard2 = LicenseGuard(
        trial, cache, trusted, hwid="hw_test", clock=lambda: datetime(2026, 1, 1, 0, 0, 0)
    )
    assert first.remaining_seconds == guard2.state().remaining_seconds


def test_guard_trial_survives_hwid_change() -> None:
    """Смена HWID не должна выдавать новое демо с нуля."""
    now = {"t": datetime(2026, 1, 1, 0, 0, 0)}
    guard, trial, cache, trusted, _ = _guard(clock=lambda: now["t"])
    guard.state()
    now["t"] = datetime(2026, 1, 4, 0, 0, 0)
    guard2 = LicenseGuard(trial, cache, trusted, hwid="hw_other", clock=lambda: now["t"])
    state = guard2.state()
    assert state.status == LicenseStatus.DEMO
    # С 1 по 4 января прошло 3 суток из 7.
    assert state.remaining_seconds == 4 * 24 * 3600
    assert trial.load().hwid == "hw_other"
    assert trial.load().started_at.startswith("2026-01-01")


def test_guard_trial_expires() -> None:
    now = {"t": datetime(2026, 1, 1, 0, 0, 0)}
    guard, _, _, _, _ = _guard(clock=lambda: now["t"])
    guard.state()
    now["t"] = datetime(2026, 1, 8, 0, 0, 1)
    state = guard.state()
    assert state.status == LicenseStatus.BLOCKED
    assert state.reason == BlockedReason.TRIAL_EXPIRED


def test_guard_clock_rollback() -> None:
    now = {"t": datetime(2026, 1, 2, 0, 0, 0)}
    guard, _, _, _, _ = _guard(clock=lambda: now["t"])
    guard.state()
    now["t"] = datetime(2026, 1, 1, 0, 0, 0)
    state = guard.state()
    assert state.status == LicenseStatus.BLOCKED
    assert state.reason == BlockedReason.CLOCK_ROLLBACK


def test_guard_pending_until_code_redeemed() -> None:
    guard, _, _, _, private = _guard(hwid="hw_me")
    guard.set_full_key(FULL_KEY)
    assert guard.state().status == LicenseStatus.PENDING_ACTIVATION
    assert guard.request_code().startswith("SAKREQ-")
    code = issue_activation_code(parse_full_key(FULL_KEY).key_id, "hw_me", private)
    assert guard.redeem_activation_code(code)
    assert guard.state().status == LicenseStatus.FULL


def test_guard_request_code_matches_key_and_hwid() -> None:
    guard, _, _, _, _ = _guard(hwid="hw_me")
    assert guard.request_code() is None
    guard.set_full_key(FULL_KEY)
    parsed = parse_full_key(FULL_KEY)
    decoded = ActivationRequest.decode(guard.request_code())
    assert decoded.key_id == parsed.key_id
    assert decoded.hwid == "hw_me"
    assert decoded.verify(parsed.secret)


def test_guard_rejects_code_for_another_machine() -> None:
    guard, _, _, _, private = _guard(hwid="hw_me")
    guard.set_full_key(FULL_KEY)
    foreign = issue_activation_code(parse_full_key(FULL_KEY).key_id, "hw_other", private)
    assert not guard.redeem_activation_code(foreign)
    assert guard.state().status == LicenseStatus.PENDING_ACTIVATION


def test_guard_rejects_code_from_untrusted_signer() -> None:
    guard, _, _, _, _ = _guard(hwid="hw_me")
    guard.set_full_key(FULL_KEY)
    forged_private, _ = generate_keypair()
    forged = issue_activation_code(parse_full_key(FULL_KEY).key_id, "hw_me", forged_private)
    assert not guard.redeem_activation_code(forged)
    assert guard.state().status == LicenseStatus.PENDING_ACTIVATION


def test_guard_code_needs_key_first() -> None:
    guard, _, _, _, private = _guard(hwid="hw_me")
    code = issue_activation_code("SAK-AAAA", "hw_me", private)
    assert not guard.redeem_activation_code(code)


def test_guard_hardware_change_returns_to_pending() -> None:
    trial = InMemoryTrialStore()
    cache = InMemoryLicenseCacheStore()
    private, public = generate_keypair()
    clock = lambda: datetime(2026, 1, 1)  # noqa: E731
    guard = LicenseGuard(trial, cache, [public], hwid="hw_me", clock=clock)
    guard.set_full_key(FULL_KEY)
    guard.redeem_activation_code(
        issue_activation_code(parse_full_key(FULL_KEY).key_id, "hw_me", private)
    )
    assert guard.state().status == LicenseStatus.FULL

    moved = LicenseGuard(trial, cache, [public], hwid="hw_new", clock=clock)
    state = moved.state()
    assert state.status == LicenseStatus.PENDING_ACTIVATION
    assert state.reason == BlockedReason.CODE_MISMATCH


def test_guard_new_key_discards_old_code() -> None:
    guard, _, cache, _, private = _guard(hwid="hw_me")
    guard.set_full_key(FULL_KEY)
    guard.redeem_activation_code(
        issue_activation_code(parse_full_key(FULL_KEY).key_id, "hw_me", private)
    )
    assert guard.state().status == LicenseStatus.FULL
    guard.set_full_key("SAK-BBBB-secretsecretsecre1")
    assert cache.load_activation_code() is None
    assert guard.state().status == LicenseStatus.PENDING_ACTIVATION


def test_guard_reentering_same_key_keeps_activation() -> None:
    """Повторный ввод того же ключа не должен сбрасывать рабочую лицензию."""
    guard, _, _, _, private = _guard(hwid="hw_me")
    guard.set_full_key(FULL_KEY)
    guard.redeem_activation_code(
        issue_activation_code(parse_full_key(FULL_KEY).key_id, "hw_me", private)
    )
    guard.set_full_key(f"  {FULL_KEY}  ")
    assert guard.state().status == LicenseStatus.FULL


def test_guard_second_trusted_key_accepted() -> None:
    private1, public1 = generate_keypair()
    private2, public2 = generate_keypair()
    guard = LicenseGuard(
        InMemoryTrialStore(),
        InMemoryLicenseCacheStore(),
        [public1, public2],
        hwid="hw_me",
        clock=lambda: datetime(2026, 1, 1),
    )
    guard.set_full_key(FULL_KEY)
    key_id = parse_full_key(FULL_KEY).key_id
    assert guard.redeem_activation_code(issue_activation_code(key_id, "hw_me", private2))
    assert guard.state().status == LicenseStatus.FULL
    _ = private1


def test_guard_broken_key_blocks() -> None:
    guard, _, cache, _, _ = _guard()
    cache.save_full_key("not-a-key")
    state = guard.state()
    assert state.status == LicenseStatus.BLOCKED
    assert state.reason == BlockedReason.INVALID_KEY


def test_guard_deactivate_after_full_burns_trial() -> None:
    guard, _, cache, _, private = _guard(hwid="hw_me")
    guard.set_full_key(FULL_KEY)
    guard.redeem_activation_code(
        issue_activation_code(parse_full_key(FULL_KEY).key_id, "hw_me", private)
    )
    assert guard.state().status == LicenseStatus.FULL
    guard.clear_commercial_key()
    assert cache.load_commercial_used() is True
    assert cache.load_activation_code() is None
    assert guard.state().status == LicenseStatus.BLOCKED


def test_guard_deactivate_before_activation_keeps_demo() -> None:
    """Ключ введён, но код так и не применён — остаток демо должен сохраниться."""
    guard, _, _, _, _ = _guard(hwid="hw_me")
    assert guard.state().status == LicenseStatus.DEMO
    guard.set_full_key(FULL_KEY)
    assert guard.state().status == LicenseStatus.PENDING_ACTIVATION
    guard.clear_commercial_key()
    state = guard.state()
    assert state.status == LicenseStatus.DEMO
    assert state.remaining_seconds == 7 * 24 * 3600
