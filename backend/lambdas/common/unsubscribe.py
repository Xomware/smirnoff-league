"""
Signed unsubscribe tokens: `<payload>.<mac>`, both unpadded base64url.

The payload is `<sub>:<type or "all">`, and the MAC is HMAC-SHA256 over the
encoded payload with the SecureString `/<app>/email-unsubscribe-secret`.
Tokens never expire: a link in a months-old email must still work, and the
most a token can do is turn email off.
"""

from __future__ import annotations

import base64
import functools
import hashlib
import hmac
import os

import boto3

from lambdas.common.email_prefs import EMAIL_TYPES

KINDS = {*EMAIL_TYPES, "all"}


@functools.cache
def _secret() -> bytes:
    ssm = boto3.client("ssm", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    name = f"/{os.environ['APP_NAME']}/email-unsubscribe-secret"
    return ssm.get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"].encode()


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _sign(payload: str) -> str:
    return _b64(hmac.new(_secret(), payload.encode(), hashlib.sha256).digest())


def make_token(sub: str, kind: str) -> str:
    if kind not in KINDS:
        raise ValueError(f"Unknown unsubscribe kind {kind!r}")
    payload = _b64(f"{sub}:{kind}".encode())
    return f"{payload}.{_sign(payload)}"


def verify(token: str) -> tuple[str, str] | None:
    """(sub, kind) for a token this secret signed, else None."""
    payload, _, mac = token.partition(".")
    # Compared as the encoded string, not decoded bytes, so the unused bits in
    # base64's last character cannot yield a second valid spelling.
    if not payload or not hmac.compare_digest(mac.encode(), _sign(payload).encode()):
        return None
    sub, _, kind = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)).decode().rpartition(":")
    return (sub, kind) if sub and kind in KINDS else None
