"""GET /users/me - the caller's identity, stored profile (null until onboarded) and admin flag."""

from __future__ import annotations

from lambdas.common.admins import is_admin
from lambdas.common.api import api_handler, caller_email, caller_sub, ok
from lambdas.common.users_dynamo import get_profile


@api_handler("users_me")
def handler(event, context):
    sub = caller_sub(event)
    email = caller_email(event)
    return ok(
        {
            "sub": sub,
            "email": email,
            "profile": get_profile(sub),
            "isAdmin": is_admin(email),
        }
    )
