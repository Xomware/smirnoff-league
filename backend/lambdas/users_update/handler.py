"""
POST /users/update - create or update the caller's profile, keyed by the token's sub.

Body: { "name": 1-40 chars, "username": 2-20 of [A-Za-z0-9_.-], "rosterId": int 1-14 }

Two users may claim the same roster: co-owners share one.
"""

from __future__ import annotations

import re

from lambdas.common.api import ValidationError, api_handler, body, caller_sub, ok
from lambdas.common.users_dynamo import save_profile

USERNAME = re.compile(r"[A-Za-z0-9_.-]{2,20}")
ROSTERS = range(1, 15)


def _invalid(field: str, message: str) -> ValidationError:
    return ValidationError(f"{field} {message}", field=field)


@api_handler("users_update")
def handler(event, context):
    sub = caller_sub(event)
    data = body(event)

    name = data.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 40:
        raise _invalid("name", "must be 1-40 characters")

    username = data.get("username")
    if not isinstance(username, str) or not USERNAME.fullmatch(username):
        raise _invalid("username", "must be 2-20 characters of letters, digits, _ . or -")

    roster_id = data.get("rosterId")
    # bool is an int subclass, so True would otherwise pass as roster 1.
    if type(roster_id) is not int or roster_id not in ROSTERS:
        raise _invalid("rosterId", "must be a whole number from 1 to 14")

    return ok(save_profile(sub, name.strip(), username, roster_id))
