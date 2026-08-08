from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
    load_pem_private_key,
    load_pem_public_key,
)


def canonical_json_bytes(payload: dict[str, Any]) -> bytes:
    return json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def generate_keypair() -> tuple[bytes, bytes]:
    private = Ed25519PrivateKey.generate()
    private_pem = private.private_bytes(Encoding.PEM, PrivateFormat.PKCS8, NoEncryption())
    public_pem = private.public_key().public_bytes(Encoding.PEM, PublicFormat.SubjectPublicKeyInfo)
    return private_pem, public_pem


def sign_payload(payload: dict[str, Any], private_pem: bytes) -> bytes:
    private = load_pem_private_key(private_pem, password=None)
    if not isinstance(private, Ed25519PrivateKey):
        raise ValueError("private key must be Ed25519")
    return private.sign(canonical_json_bytes(payload))


def verify_payload(payload: dict[str, Any], signature: bytes, public_pems: list[bytes]) -> bool:
    message = canonical_json_bytes(payload)
    for pem in public_pems:
        try:
            public = load_pem_public_key(pem)
            if not isinstance(public, Ed25519PublicKey):
                continue
            public.verify(signature, message)
            return True
        except Exception:
            continue
    return False


def sha256_hex(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def hmac_sha256_hex(secret: str, payload: dict[str, Any]) -> str:
    digest = hmac.new(
        secret.encode("utf-8"),
        canonical_json_bytes(payload),
        hashlib.sha256,
    ).hexdigest()
    return digest


def verify_hmac(secret: str, payload: dict[str, Any], mac_hex: str) -> bool:
    expected = hmac_sha256_hex(secret, payload)
    return hmac.compare_digest(expected, mac_hex)
