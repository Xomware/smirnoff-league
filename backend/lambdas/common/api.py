"""
API Gateway plumbing: identity, request parsing, the { data, error, meta }
envelope, and error mapping.

Identity comes from the native COGNITO_USER_POOLS authorizer, which has
already verified the JWT before the Lambda is invoked. Handlers read the
claims it deposited; they never parse or trust a raw token.
"""

from __future__ import annotations

import decimal
import functools
import json
import os
from typing import Any, Callable

from lambdas.common.logger import get_logger

log = get_logger(__file__)


class ApiError(Exception):
    status = 500

    def __init__(self, message: str, status: int | None = None, **detail):
        super().__init__(message)
        self.message = message
        if status is not None:
            self.status = status
        self.detail = detail


class ValidationError(ApiError):
    status = 400


class UnauthorizedError(ApiError):
    status = 401


class ForbiddenError(ApiError):
    status = 403


class NotFoundError(ApiError):
    status = 404


class ConflictError(ApiError):
    status = 409


class _Encoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, decimal.Decimal):
            as_int = int(o)
            return as_int if o == as_int else float(o)
        if isinstance(o, set):
            return sorted(o)
        return super().default(o)


def respond(status: int, data: Any = None, error: dict | None = None, meta: dict | None = None) -> dict:
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Headers": "Authorization,Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        },
        "body": json.dumps({"data": data, "error": error, "meta": meta}, cls=_Encoder),
        "isBase64Encoded": False,
    }


def ok(data: Any, meta: dict | None = None) -> dict:
    return respond(200, data, meta=meta)


def allow_origin(event: dict) -> str:
    """
    Echo the caller's Origin when it is allowed, else the primary origin.

    A response can name only one origin, and the site plus local dev are two,
    so this mirrors the module's OPTIONS preflight VTL.
    """
    allowed = os.environ.get("CORS_ALLOW_ORIGIN", "*").split(",")
    headers = (event or {}).get("headers") or {}
    origin = headers.get("origin") or headers.get("Origin")
    return origin if origin in allowed else allowed[0]


def api_handler(name: str) -> Callable:
    """
    Wraps a handler so an ApiError becomes its status and anything else
    becomes a 500 with the detail in the log rather than the response body.
    """

    def decorate(fn):
        @functools.wraps(fn)
        def wrapper(event, context):
            try:
                response = fn(event, context)
            except ApiError as e:
                log.warning("%s rejected: %s %s", name, e.status, e.message)
                error = {"handler": name, "message": e.message}
                if e.detail:
                    error["detail"] = e.detail
                response = respond(e.status, error=error)
            except Exception:  # noqa: BLE001 -- a stack trace must not reach the browser
                log.exception("%s failed", name)
                response = respond(500, error={"handler": name, "message": "Internal error"})
            response["headers"]["Access-Control-Allow-Origin"] = allow_origin(event)
            return response

        return wrapper

    return decorate


def claims(event: dict) -> dict:
    ctx = (event or {}).get("requestContext") or {}
    return ((ctx.get("authorizer") or {}).get("claims")) or {}


def caller_sub(event: dict) -> str:
    sub = claims(event).get("sub")
    if not sub:
        raise UnauthorizedError("No subject on the token")
    return sub


def caller_email(event: dict) -> str:
    """
    The authenticated user's email, lowercased.

    Only ID tokens carry `email`; an access token passes the authorizer but
    lands here without one. Lowercased because Cognito does not guarantee the
    casing a user signed up with, and the admin list compares by email.
    """
    email = (claims(event).get("email") or "").strip().lower()
    if not email:
        raise UnauthorizedError("No verified email on the token")
    return email


def body(event: dict) -> dict:
    raw = (event or {}).get("body")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        raise ValidationError("Body is not valid JSON")
    if not isinstance(parsed, dict):
        raise ValidationError("Body must be a JSON object")
    return parsed


def query(event: dict) -> dict:
    return (event or {}).get("queryStringParameters") or {}


def require(source: dict, *fields: str) -> list[str]:
    """Pull required string fields, erroring on the first missing one."""
    out = []
    for field in fields:
        value = source.get(field)
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValidationError(f"{field} is required", field=field)
        out.append(value.strip() if isinstance(value, str) else value)
    return out


def whole(source: dict, field: str, lo: int, hi: int) -> int:
    value = source.get(field)
    # bool is an int subclass, so True would otherwise pass as 1.
    if type(value) is not int or not lo <= value <= hi:
        raise ValidationError(f"{field} must be a whole number from {lo} to {hi}", field=field)
    return value


def text(source: dict, field: str, required: bool = True) -> str | None:
    value = source.get(field)
    if value is None and not required:
        return None
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} must be non-blank text", field=field)
    return value.strip()
