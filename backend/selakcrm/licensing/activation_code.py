"""Коды активации: клиент отдаёт код запроса, вендор возвращает подписанный код ответа.

Код ответа — только подпись Ed25519 над парой (key_id, hwid). Полезная нагрузка в нём
не передаётся: клиент знает свой ключ и HWID и собирает то же самое сообщение сам.
Поэтому код ответа короткий и работает только на том компьютере, для которого выдан.
"""

from __future__ import annotations

import base64
import hmac
from dataclasses import dataclass
from typing import Any

from selakcrm.licensing.crypto import hmac_sha256_hex, sign_payload, verify_payload
from selakcrm.licensing.keys import InvalidKeyFormat, ParsedKey

REQUEST_PREFIX = "SAKREQ-"
CODE_PREFIX = "SAKACT-"

_REQUEST_VERSION = "1"
_MAC_HEX_LENGTH = 32


def _b64encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64decode(text: str) -> bytes:
    padded = text + "=" * (-len(text) % 4)
    return base64.urlsafe_b64decode(padded.encode("ascii"))


def _strip_prefix(code: str, prefix: str) -> str:
    compact = "".join(code.split())
    if compact.upper().startswith(prefix):
        return compact[len(prefix) :]
    return compact


def _request_mac(secret: str, key_id: str, hwid: str) -> str:
    return hmac_sha256_hex(secret, {"hwid": hwid, "key_id": key_id})[:_MAC_HEX_LENGTH]


@dataclass(frozen=True)
class ActivationRequest:
    key_id: str
    hwid: str
    mac: str

    def verify(self, secret: str) -> bool:
        return hmac.compare_digest(self.mac, _request_mac(secret, self.key_id, self.hwid))

    def encode(self) -> str:
        body = f"{_REQUEST_VERSION}|{self.key_id}|{self.hwid}|{self.mac}"
        return REQUEST_PREFIX + _b64encode(body.encode("utf-8"))

    @staticmethod
    def decode(code: str) -> ActivationRequest:
        try:
            body = _b64decode(_strip_prefix(code, REQUEST_PREFIX)).decode("utf-8")
        except Exception as exc:
            raise InvalidKeyFormat("invalid activation request") from exc
        parts = body.split("|")
        if len(parts) != 4 or parts[0] != _REQUEST_VERSION:
            raise InvalidKeyFormat("invalid activation request")
        _, key_id, hwid, mac = parts
        if not key_id or not hwid or len(mac) != _MAC_HEX_LENGTH:
            raise InvalidKeyFormat("invalid activation request")
        return ActivationRequest(key_id=key_id, hwid=hwid, mac=mac)


def build_activation_request(parsed_key: ParsedKey, hwid: str) -> ActivationRequest:
    return ActivationRequest(
        key_id=parsed_key.key_id,
        hwid=hwid,
        mac=_request_mac(parsed_key.secret, parsed_key.key_id, hwid),
    )


def _code_payload(key_id: str, hwid: str) -> dict[str, Any]:
    return {"hwid": hwid, "key_id": key_id, "v": 1}


def issue_activation_code(key_id: str, hwid: str, private_pem: bytes) -> str:
    signature = sign_payload(_code_payload(key_id, hwid), private_pem)
    return CODE_PREFIX + _b64encode(signature)


def verify_activation_code(
    code: str,
    key_id: str,
    hwid: str,
    trusted_public_keys: list[bytes],
) -> bool:
    try:
        signature = _b64decode(_strip_prefix(code, CODE_PREFIX))
    except Exception:
        return False
    return verify_payload(_code_payload(key_id, hwid), signature, trusted_public_keys)
