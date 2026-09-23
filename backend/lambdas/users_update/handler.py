"""
POST /users/update - create or update the caller's profile, keyed by the token's sub.

Body: { "name": 1-40 chars, "username": 2-20 of [A-Za-z0-9_.-], "rosterId": int 1-14,
        "notificationsSeenAt"?: ISO 8601 with an offset, not in the future }

`notificationsSeenAt` may also be sent alone, to mark notifications read
without resending the profile.

`email` is sent only on its own: { "optIn": bool, "types": { <each EMAIL_TYPES key>: bool } },
the whole object every time.

Every save also stores the token's email as `emailAddress`, where alerts go.

Two users may claim the same roster: co-owners share one.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from lambdas.common.api import ValidationError, api_handler, body, caller_email, caller_sub, ok
from lambdas.common.email_prefs import parse_prefs
from lambdas.common.users_dynamo import save_profile, update_profile

USERNAME = re.compile(r"[A-Za-z0-9_.-]{2,20}")
ROSTERS = range(1, 15)
PROFILE_KEYS = {"name", "username", "rosterId"}
# The browser stamps "now" with its own clock, which can run a little ahead of ours.
CLOCK_SKEW = timedelta(minutes=2)


def _invalid(field: str, message: str) -> ValidationError:
    return ValidationError(f"{field} {message}", field=field)


def _seen_at(value) -> str:
    message = "must be an ISO 8601 time with an offset, not in the future"
    if not isinstance(value, str):
        raise _invalid("notificationsSeenAt", message)
    try:
        at = datetime.fromisoformat(value)
    except ValueError:
        raise _invalid("notificationsSeenAt", message)
    if at.tzinfo is None or at > datetime.now(timezone.utc) + CLOCK_SKEW:
        raise _invalid("notificationsSeenAt", message)
    return value


@api_handler("users_update")
def handler(event, context):
    sub = caller_sub(event)
    address = caller_email(event)
    data = body(event)

    if "email" in data:
        if len(data) > 1:
            raise _invalid("email", "must be sent on its own")
        return ok(update_profile(sub, {"email": parse_prefs(data["email"]), "emailAddress": address}))

    seen_at = _seen_at(data["notificationsSeenAt"]) if "notificationsSeenAt" in data else None
    if seen_at is not None and PROFILE_KEYS.isdisjoint(data):
        return ok(update_profile(sub, {"notificationsSeenAt": seen_at, "emailAddress": address}))

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

    return ok(save_profile(sub, name.strip(), username, roster_id, address, seen_at))
