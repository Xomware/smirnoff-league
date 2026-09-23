"""
POST /ices/chug-time - log how long an ice took to chug. Signed in.

Body: { "iceId": str, "seconds": number, 0 < seconds < 600, rounded to 0.1, "chugger": object (optional) }

A player may time only ices on their own claimed roster, and the chugger is
always them. An admin may time any ice and name the chugger as { "sub": str }
for a league user or { "name": str <= 40 } for anyone without an account.
Without one, an admin's own ice names them and any other ice keeps the chugger
on record. Completion status is never touched.
"""

from __future__ import annotations

from lambdas.common import ice_admin
from lambdas.common.admins import is_admin
from lambdas.common.api import (
    ForbiddenError,
    NotFoundError,
    api_handler,
    body,
    caller_email,
    caller_sub,
    ok,
    text,
)
from lambdas.common.ices_dynamo import get_ice, public_ice
from lambdas.common.users_dynamo import get_profile


@api_handler("ices_chug_time")
def handler(event, context):
    sub = caller_sub(event)
    email = caller_email(event)
    data = body(event)
    ice_id = text(data, "iceId")
    seconds = ice_admin.chug_seconds(data.get("seconds"))

    ice = get_ice(ice_id)
    if ice is None:
        raise NotFoundError(f"no ice {ice_id}", field="iceId")
    profile = get_profile(sub) or {}
    mine = profile.get("rosterId") == ice["rosterId"]
    admin = is_admin(email)
    if not mine and not admin:
        raise ForbiddenError("That ice is not on your roster")

    picked = data.get("chugger")
    if picked is not None and admin:
        chugger = ice_admin.chugger(picked)
    elif picked is not None and not (isinstance(picked, dict) and picked.get("sub") == sub):
        raise ForbiddenError("Only admins can name another chugger")
    else:
        chugger = {"sub": sub, "name": profile["name"]} if mine else None

    return ok(public_ice(ice_admin.set_chug(ice_id, seconds, chugger, sub, email)))
