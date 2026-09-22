"""GET /users/me. Identity only for now; #13 adds the stored profile and the admin check."""

from __future__ import annotations

from lambdas.common.api import api_handler, caller_email, caller_sub, ok


@api_handler("users_me")
def handler(event, context):
    return ok(
        {
            "sub": caller_sub(event),
            "email": caller_email(event),
            "profile": None,
            "isAdmin": False,
        }
    )
